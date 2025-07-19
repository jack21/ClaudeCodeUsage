# Claude Code Usage

🌐 **多語言文檔 | Multi-language Documentation | 多语言文档 | 多言語ドキュメント | 다국어 문서**

- [English](README-en.md)
- [繁體中文](README-zh-TW.md)
- [简体中文](README-zh-CN.md)
- [日本語](README-ja.md)
- [한국어](README-ko.md)

---

A VSCode extension that monitors Claude Code usage and costs directly in your status bar.

## Features

- **Real-time Monitoring**: Display current session costs in the VSCode status bar
- **Detailed Breakdown**: Click to view detailed usage statistics including:
  - Current session, daily, and monthly usage
  - Token consumption (input/output/cache)
  - Cost breakdown by model
  - Message count tracking
- **Multi-language Support**: Auto-detection or manual language selection (English, 繁體中文, 简体中文, 日本語, 한국어)
- **Configurable Refresh**: Set refresh intervals from 30 seconds to any desired frequency
- **Auto-detection**: Automatically finds your Claude data directory
- **Custom Themes**: Supports both light and dark VSCode themes

## Installation

1. Install the extension from the VSCode marketplace
2. The extension will automatically detect your Claude Code data directory
3. Start using Claude Code and see your usage appear in the status bar

## Configuration

Access settings via `File > Preferences > Settings` and search for "Claude Code Usage":

- **Refresh Interval**: How often to update usage data (minimum 30 seconds)
- **Data Directory**: Custom Claude data directory path (leave empty for auto-detection)
- **Language**: Display language preference
- **Decimal Places**: Number of decimal places for cost display

## Usage

1. **Status Bar**: Shows current session cost with a pulse icon
2. **Click Status Bar**: Opens detailed usage breakdown popup
3. **Popup Tabs**: Switch between Current Session, Today, and This Month views
4. **Manual Refresh**: Click the refresh button to update data immediately

## Requirements

- Claude Code must be installed and running
- VSCode 1.74.0 or later

## Troubleshooting

If the extension shows "No Claude Code Data":

1. Ensure Claude Code is installed and has been used
2. Check the data directory setting in extension preferences
3. Verify Claude Code is generating usage logs

## License

MIT

## Contributing

Issues and pull requests are welcome on the GitHub repository.