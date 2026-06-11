# 架构说明

> 本扩展的简明技术地图——它是什么、数据如何流动、以及那些"精确的" token / 成本
> 数字是怎么算出来的。刻意写得简短：它是给贡献者（或自动化的 issue/PR 助手）
> 读的参考，让他们**不必**重新通读 `src/`。如果你改变了某个模块的职责或数据
> 流，请同步更新本文件。英文版见
> [`ARCHITECTURE.md`](ARCHITECTURE.md)。

## 它是什么（以及不是什么）

**Claude Code Usage** 是一个 VS Code 扩展，通过读取 Claude Code 自己的本地日志，
在状态栏和仪表盘 webview 中报告 Claude Code 的 token 用量与成本。它刻意保持：

- **只服务 Claude**——围绕 Claude Code 的日志格式和 Anthropic 的 OAuth 额度构建。
  （为方便 CC-Switch 用户，也给 DeepSeek 等做了定价，但 Claude 是核心。）
- **轻量**——界面精简、无运行时依赖、次要视图默认折叠。
- **聚焦 token 归因**——头部的核心数字是**精确的**，直接读自每次请求自带的用量
  记账，而非估算。
- 对 `~/.claude` **只读**——绝不写入 Claude Code 的数据。

**范围之外**（用这张清单做 issue 初筛）：把多供应商/多厂商仪表盘当作一等功能；
完整的账单/发票对账；写入或驱动 Claude Code；与用量无关的分析。能让 token 洞察、
归因或建议体验更锋利的需求，才是合适的方向。

## 模块地图（`src/`）

| 模块 | 职责 |
|---|---|
| `extension.ts` | 激活、命令注册，以及刷新编排：一个"感知活跃度"、会自我重排的定时器（你活跃时更快、空闲时更缓），带 generation 守卫与合并去重，外加 `pauseDashboardRefresh`。把 loader + 状态栏 + webview + 额度客户端串起来。 |
| `dataLoader.ts` | 数据管线。读取 `~/.claude/projects/**/*.jsonl`，解析/校验/去重记录，提取会话标题与用户提示标记，并完成全部聚合（`calculateUsageData` + 今日/本月/会话/项目/分组/分支等口径）。逻辑量最大的一块。 |
| `pricing.ts` | 按模型、按 token 的费率表（input / output / 缓存写 / 缓存读分别计价），模型家族推断，以及 `[1m]` 上下文后缀的剥离。`calculateCostBreakdown` 把一条用量记录变成四部分成本。 |
| `statusBar.ts` | 状态栏条目：今日成本、当前会话、额度窗口（5 小时 / 每周），含过期窗口的滚动前移与丰富的悬浮提示。 |
| `webview.ts` | 仪表盘：分页视图（概览、会话、项目、内容……）、带网格的堆叠"成本构成"图表、可排序表格。是体量最大的文件——几乎所有 UI 都在这里。 |
| `claudeApiClient.ts` | Anthropic OAuth 额度：读取 `~/.claude/.credentials.json`，刷新 token（先重读磁盘），并从 `api.anthropic.com/api/oauth/usage` 拉取真实用量。当 Anthropic 的 TLS 指纹门返回 `403 "Request not allowed"` 时，从 `fetch` 回退到系统 `curl`；遇到 HTTP 429 冷却 60 秒。 |
| `advisor.ts` | AI 建议功能：把一份紧凑的用量摘要发给 Claude API（用用户**自己**的 key），渲染自然语言建议。需手动开启。 |
| `adviceDemoSample.ts` | 在配置 key 之前，于建议面板展示的静态示例建议（六种语言全覆盖），让功能可被发现。 |
| `i18n.ts` | 六种语言的字符串表：`en`、`de-DE`、`zh-TW`、`zh-CN`、`ja`、`ko`。所有面向用户的字符串都经过这里。 |
| `types.ts` | 共享接口（`ClaudeUsageRecord`、`UsageData`、`SessionUsage`、`SupportedLanguage`、额度类型……）。 |

## 数据流

```
~/.claude/projects/<编码后的cwd>/<会话>.jsonl       （一个文件 = 一段对话）
        │  逐行读取，对每行 JSON.parse
        ▼
校验（是用量记录吗？）─► 去重（messageId+requestId，保留 token 更高的那条）
        │  给每条记录打上 会话 id + 项目（优先用真实 cwd）
        ▼
ClaudeUsageRecord[]  ──►  calculateUsageData()  ──►  UsageData
        │                  （对 4 个 token 桶求和并各自计价）          │
        │                                                             ├─► 状态栏（今日 + 额度）
        └─ 会话标题、用户提示标记                                      └─► webview（各口径明细 + 图表）
```

额度是一条**独立**路径：`claudeApiClient` 调用 OAuth 用量接口，独立于本地日志地
返回 5 小时 / 7 天 / 7 天 Opus 的用量占比（日志无从得知你套餐的上限，只有
Anthropic 知道）。

## token 与成本如何计算（精确，而非估算）

JSONL 里每一行助手回复都带一个 `message.usage` 对象——这是 **Anthropic API 自己
的 token 记账**，与 Anthropic 计费所依据的数字相同。扩展不去估算它们，而是读取、
校验、去重、求和、计价：

1. **校验**——只保留 `usage.input_tokens` 为数字的记录（真实 API 响应）；跳过
   合成 / 报错 / `<synthetic>` 模型条目。
2. **去重**——哈希 = `messageId + requestId`；冲突时保留 token 更高的那条（应对
   某些代理会先记一行占位、再记真实数值的情况）。
3. **求和**，把四个桶累加进总数：
   - `input_tokens`——新鲜的 prompt，全价
   - `cache_read_input_tokens`——从缓存命中的前缀，约为 input 价的 10%
   - `cache_creation_input_tokens`——**写入**缓存的前缀（即"输入缓存（未命中）"
     那根条），约为 input 价的 125%；在切换模型或间隔 >5 分钟后会飙升（prompt
     缓存按模型隔离，TTL 约 5 分钟）
   - `output_tokens`——生成内容，output 价
4. **计价**——每个桶 × 其按模型的费率（`pricing.ts`）；成本 = 求和。

产品中**唯一**的估算，是"内容"标签页里基于字符数的"什么在吃 token"拆解（以及计划
中的 v2.2 模型匹配 / 缓存浪费功能）——它们始终标注为估算，绝不并入精确总数。
"消息数"只统计用户手敲的 prompt，靠合成的零 token 标记记录实现，因此永不影响 token
求和。

## 关键不变量（别破坏它们）

- 对 `~/.claude` **只读**。
- 所有面向用户的字符串都要走 `i18n.ts`，且**六种语言齐全**。
- 新设置**默认维持现有行为**（opt-in）；任何非只读或有风险的功能放到
  `experimental.*` 键下。
- **不新增运行时依赖。**
- 精确总数与标注过的估算，永不混在一起。

## 刷新模型

仪表盘 / 状态栏靠 `extension.ts` 里一个感知活跃度的循环保持最新：一个自我重排的
定时器，你活跃时间隔缩短、空闲时拉长，由 `refreshGen` generation 计数器与合并去重
守护，避免重叠刷新堆叠。对 `~/.claude/projects` 的文件监听（可关闭）带来约 1.5 秒
延迟；定时器是兜底。面板打开查看时，`pauseDashboardRefresh` 会冻结更新。

## 发布

TypeScript strict、`npm run compile` 干净通过；用户可见的改动写入 `CHANGELOG.md`；
squash-merge 到 `main`；把 `v*` 标签推到**上游**（`jack21/ClaudeCodeUsage`）→
`.github/workflows/publish.yml` 校验标签与 `package.json` 一致，用 `@vscode/vsce`
打包，发布到 VS Code Marketplace + Open VSX，并把 `.vsix` 附到 GitHub Release。
