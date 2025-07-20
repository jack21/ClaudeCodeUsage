# Claude Code Usage

🌐 **Language | 語言 | 言語 | 언어**: [🏠 Main](README.md) | **English** | [繁體中文](README-zh-TW.md) | [简体中文](README-zh-CN.md) | [日本語](README-ja.md) | [한국어](README-ko.md)

---

A comprehensive VSCode extension that monitors Claude Code usage and costs with detailed analytics and interactive visualizations.

## 🖼️ Screenshot

### Status Bar

![Status Bar Preview](images/status-bar-preview.jpg)

### Dashboard

![Dashboard Preview](images/dashboard-preview.jpg)

## ✨ Features

### 📊 Real-time Monitoring
- **Status Bar Display**: Shows today's usage costs in the VSCode status bar
- **Live Updates**: Automatic data refresh with configurable intervals (minimum 30 seconds)
- **Zero Dependencies**: Built with native Node.js modules for maximum compatibility

### 📈 Interactive Analytics Dashboard
- **Multiple Time Views**: Today, This Month, and All Time perspectives
- **Interactive Charts**: Switchable bar charts with 6 different metrics:
  - Cost breakdown
  - Input/Output tokens
  - Cache creation/read tokens
  - Message counts
- **Detailed Tables**: Comprehensive daily/monthly usage breakdowns
- **Model Analysis**: Per-model cost and token consumption tracking

![Dashboard Preview](images/dashboard-preview.png)

### 🌐 Multi-language Support
- **5 Languages**: English, 繁體中文, 简体中文, 日本語, 한국어
- **Auto-detection**: Automatically detects system language
- **Manual Override**: Choose your preferred language in settings

### 🎨 Visual Features
- **Bottom-up Charts**: Industry-standard chart orientation
- **Monthly Trends**: All-time view shows monthly aggregated data for long-term analysis
- **VSCode Theme Integration**: Seamless light/dark theme support
- **Responsive Design**: Optimized for different screen sizes

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