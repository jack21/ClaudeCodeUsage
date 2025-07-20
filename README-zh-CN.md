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
- **多重时间视图**：今日、本月和所有时间的使用角度
- **交互式图表**：可切换的柱状图表，支持 6 种不同指标：
  - 成本分析
  - 输入/输出 tokens
  - 缓存创建/读取 tokens
  - 消息数量
- **详细表格**：完整的每日/每月使用量分析
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

## 使用方式

1. **状态栏**：显示当前会话成本，附带脉冲图标
2. **点击状态栏**：打开详细使用量分析弹出窗口
3. **弹出窗口标签**：在当前会话、今日和本月视图之间切换
4. **手动刷新**：点击刷新按钮立即更新数据

## 系统要求

- 必须安装并运行 Claude Code
- VSCode 1.74.0 或更新版本

## 故障排除

如果扩展显示「无 Claude Code 数据」：

1. 确保已安装并使用过 Claude Code
2. 检查扩展首选项中的数据目录设置
3. 验证 Claude Code 正在生成使用记录

## 许可证

MIT

## 贡献

欢迎在 GitHub 仓库提出 Issue 和 Pull Request。