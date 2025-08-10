# Claude Code Usage

🌐 **Language | 語言 | 言語 | 언어**: [🏠 Main](README.md) | **English** | [繁體中文](README-zh-TW.md) | [简体中文](README-zh-CN.md) | [日本語](README-ja.md) | [한국어](README-ko.md)

---

A comprehensive VSCode extension that monitors Claude Code usage and costs with detailed analytics and interactive visualizations.

## 🖼️ Screenshot

### Status Bar

![Status Bar Preview](https://raw.githubusercontent.com/jack21/ClaudeCodeUsage/refs/heads/main/images/status-bar-preview.jpg)

### Dashboard

![Dashboard Preview](https://raw.githubusercontent.com/jack21/ClaudeCodeUsage/refs/heads/main/images/dashboard-preview.jpg)

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
- **Hourly Breakdown**: Detailed hourly usage analysis for today and specific dates
- **Expandable Monthly Data**: Click on any month in "All Time" to view daily breakdown
- **Detailed Tables**: Comprehensive daily/monthly usage breakdowns with drill-down capabilities
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

## 🚀 Usage

### Status Bar
- Shows **today's usage cost** with a pulse icon
- Click to open the detailed analytics dashboard

### Analytics Dashboard

1. **Time Tabs**: Switch between Today, This Month, and All Time views
2. **Chart Metrics**: Click tabs above charts to switch between:
   - Cost breakdown
   - Input/Output tokens
   - Cache creation/read tokens
   - Message counts
3. **Hourly Analysis**: View hourly usage patterns in "Today" tab
4. **Expandable Data**: 
   - Click on daily entries in "This Month" to see hourly breakdown
   - Click on monthly entries in "All Time" to see daily breakdown
5. **Interactive Tables**: Detailed daily/monthly breakdowns below charts
6. **Model Analysis**: Per-model usage statistics in each tab

## 📋 Requirements

- **Claude Code**: Must be installed and running
- **VSCode**: Version 1.74.0 or later
- **Node.js**: Built-in modules only (no external dependencies)

## 🛠️ Troubleshooting

### "No Claude Code Data" Error

1. Ensure Claude Code is installed and has been used
2. Check the data directory setting in extension preferences
3. Verify Claude Code is generating usage logs in `~/.claude/projects` or `~/.config/claude/projects`

### Charts Not Updating

1. Switch to a different tab and back to refresh the chart
2. Check if the time period has actual usage data
3. Verify cache tokens are available in your Claude usage

### Performance Issues

- Increase refresh interval if experiencing slowdowns
- Extension uses 1-minute caching to minimize file I/O

## License

MIT

## 📝 Changelog

### v1.0.6 (2025-08-10)
- 🆕 Added support for Claude Opus 4.1 model pricing
- 🔄 Updated pricing data to include `claude-opus-4-1-20250805` and `claude-opus-4-1` model IDs
- 📊 Pricing remains the same as Opus 4 ($15/1M input, $75/1M output tokens)

### v1.0.5 (2025-01)
- ⏰ Added hourly usage statistics and visualization
- 📈 Enhanced dashboard with hourly breakdown functionality
- 🔧 Improved data processing for hourly aggregation

### v1.0.4 (2025-01)
- 📊 Added all-time data calculation functionality
- 🎨 Updated UI to display all-time usage data with charts and labels
- 🔄 Fixed data update logic to support new data structure
- 🌐 Added "All Time" translations to multi-language support

### v1.0.3 (2025-01)
- 🔗 Updated GitHub repository URL
- 🖼️ Fixed README image links to point to new repository location
- 📦 Version bump and repository migration

### v1.0.0 (2025-01)
- 🎉 Initial complete release
- 📊 Real-time Claude Code usage monitoring in status bar
- 🌐 Multi-language support (English, 繁體中文, 简体中文, 日本語, 한국어)
- 📈 Interactive analytics dashboard with charts and tables
- 🎨 VSCode theme integration and responsive design
- ⚙️ Configurable refresh intervals and settings

## Contributing

Issues and pull requests are welcome on the GitHub repository.