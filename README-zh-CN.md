# Claude Code 使用量监控

🌐 **Language | 語言 | 言語 | 언어**: [🏠 Main](README.md) | [English](README-en.md) | [繁體中文](README-zh-TW.md) | **简体中文** | [日本語](README-ja.md) | [한국어](README-ko.md)

---

全面的 VSCode 扩展，提供 Claude Code 使用量监控、详细分析和交互式可视化图表。

## 🖼️ 截图

### 状态栏

![状态栏预览](https://raw.githubusercontent.com/jack21/ClaudeCodeUsage/refs/heads/main/images/status-bar-preview.jpg)

### 仪表板

![仪表板预览](https://raw.githubusercontent.com/jack21/ClaudeCodeUsage/refs/heads/main/images/dashboard-preview.jpg)

## ✨ 功能特色

### 📊 实时监控

- **状态栏显示**：在 VSCode 状态栏显示今日使用成本
- **实时更新**：自动数据刷新，可配置更新间隔（最少 30 秒）
- **零外部依赖**：使用原生 Node.js 模块，确保最大兼容性

### 📈 交互式分析仪表板

- **多重时间视图**：今日、本月和所有时间的使用视角
- **交互式图表**：可切换的柱状图表，支持 6 种不同指标：
  - 成本分析
  - 输入/输出 tokens
  - 缓存创建/读取 tokens
  - 消息数量
- **每小时使用量分析**：提供今日及特定日期的详细每小时使用分析
- **可展开的月度数据**：点击"所有时间"中的任何月份查看每日明细
- **详细表格**：完整的每日/每月使用量分析，支持向下深入查询
- **模型分析**：各模型的成本和 token 消耗跟踪

![仪表板预览](images/dashboard-preview.png)

### 🌐 多语言支持

- **5 种语言**：English, 繁體中文, 简体中文, 日本語, 한국어
- **自动检测**：自动检测系统语言
- **手动覆盖**：在设置中选择偏好语言

### 🎨 视觉功能

- **自下而上图表**：符合行业标准的图表方向
- **月度趋势**：所有时间视图显示月度聚合数据，便于长期趋势分析
- **VSCode 主题集成**：完美配合浅色/深色主题
- **响应式设计**：针对不同屏幕尺寸优化

## 📥 下载

### VSCode Marketplace
[![VSCode Marketplace](https://img.shields.io/visual-studio-marketplace/v/growthjack.claude-code-usage?style=for-the-badge&logo=visual-studio-code&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=growthjack.claude-code-usage)

### Open VSX Registry（适用于 Cursor / Windsurf / Antigravity）
[![Open VSX](https://img.shields.io/open-vsx/v/GrowthJack/claude-code-usage?style=for-the-badge&logo=eclipseide&label=Open%20VSX%20Registry)](https://marketplace.cursorapi.com/items/?itemName=GrowthJack.claude-code-usage)

## 安装

1. 从 VSCode 市场安装扩展
2. 扩展会自动检测您的 Claude Code 数据目录
3. 开始使用 Claude Code，您的使用量会出现在状态栏中

## 配置

通过 `文件 > 首选项 > 设置` 并搜索「Claude Code Usage」来访问设置：

- **刷新间隔**：更新使用数据的频率（最少 30 秒）
- **数据目录**：自定义 Claude 数据目录路径（留空以自动检测）
- **语言**：显示语言偏好
- **小数位数**：成本显示的小数位数

## 🚀 使用方式

### 状态栏

- 显示**今日使用成本**，附带脉冲图标
- 点击打开详细分析仪表板

### 分析仪表板

1. **时间标签**：在今日、本月和所有时间视图之间切换
2. **图表指标**：点击图表上方的标签切换不同指标：
   - 成本分析
   - 输入/输出 tokens
   - 缓存创建/读取 tokens
   - 消息数量
3. **每小时分析**：在"今日"标签中查看每小时使用模式
4. **可展开数据**：
   - 点击"本月"中的每日项目可查看每小时明细
   - 点击"所有时间"中的每月项目可查看每日明细
5. **交互式表格**：图表下方的详细每日/每月分析
6. **模型分析**：各标签中的模型使用统计

![使用流程](images/usage-flow.png)

## 📋 系统要求

- **Claude Code**：必须安装并运行
- **VSCode**：1.74.0 或更新版本
- **Node.js**：仅使用内置模块（无外部依赖）

## 🛠️ 故障排除

### "无 Claude Code 数据"错误

1. 确保已安装并使用过 Claude Code
2. 检查扩展首选项中的数据目录设置
3. 验证 Claude Code 正在 `~/.claude/projects` 或 `~/.config/claude/projects` 生成使用记录

### 图表不更新

1. 切换到不同标签再切回来刷新图表
2. 检查该时间段是否有实际使用数据
3. 验证 Claude 使用记录中是否有缓存 tokens

### 性能问题

- 如遇到速度变慢，可增加刷新间隔
- 扩展使用 1 分钟缓存来减少文件 I/O

## 📝 版本更新日志

### v1.0.7 (2025-11-28)

- 🌐 新增每小时使用量标签的多语言翻译支持
- 🔧 移除代码中硬编码的中文文字，改用 i18n 翻译系统
- ✨ 确保用户界面的多语言一致性（英文、繁体中文、简体中文、日文、韩文）

### v1.0.6 (2025-08-10)
- 🆕 新增 Claude Opus 4.1 模型定价支持
- 🔄 更新定价数据以包含 `claude-opus-4-1-20250805` 和 `claude-opus-4-1` 模型ID
- 📊 定价与 Opus 4 相同（$15/1M 输入，$75/1M 输出 tokens）

### v1.0.5 (2025-01)
- ⏰ 新增每小时使用量统计与可视化
- 📈 增强仪表板的每小时细分功能
- 🔧 改善每小时汇总的数据处理

### v1.0.4 (2025-01)
- 📊 新增全时间数据计算功能
- 🎨 更新 UI 以显示全时间使用数据与图表和标签
- 🔄 修正数据更新逻辑以支持新数据结构
- 🌐 在多语言支持中新增「全时间」翻译

### v1.0.3 (2025-01)
- 🔗 更新 GitHub 仓库 URL
- 🖼️ 修正 README 图片链接指向新仓库位置
- 📦 版本升级与仓库迁移

### v1.0.0 (2025-01)
- 🎉 首次完整发行版
- 📊 状态栏实时 Claude Code 使用量监控
- 🌐 多语言支持（English, 繁體中文, 简体中文, 日本語, 한국어）
- 📈 交互式分析仪表板与图表和表格
- 🎨 VSCode 主题整合与响应式设计
- ⚙️ 可设定的重新整理间隔与设定

## 许可证

MIT

## 贡献

欢迎在 GitHub 仓库提出 Issue 和 Pull Request。