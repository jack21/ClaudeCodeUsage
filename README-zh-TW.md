# Claude Code 使用量監控

🌐 **Language | 語言 | 言語 | 언어**: [🏠 Main](README.md) | [English](README-en.md) | **繁體中文** | [简体中文](README-zh-CN.md) | [日本語](README-ja.md) | [한국어](README-ko.md)

---

全方位的 VSCode 擴充功能，提供 Claude Code 使用量監控、詳細分析和互動式視覺化圖表。

## 🖼️ 截圖

### 狀態列

![狀態列預覽](https://raw.githubusercontent.com/jack21/ClaudeCodeUsage/refs/heads/main/images/status-bar-preview.jpg)

### 儀表板

![儀表板預覽](https://raw.githubusercontent.com/jack21/ClaudeCodeUsage/refs/heads/main/images/dashboard-preview.jpg)

## ✨ 功能特色

### 📊 即時監控

- **狀態列顯示**：在 VSCode 狀態列顯示今日使用成本
- **即時更新**：自動資料更新，可設定更新間隔（最少 30 秒）
- **零外部依賴**：使用原生 Node.js 模組，確保最大相容性

### 📈 互動式分析儀表板

- **多重時間檢視**：今日、本月和所有時間的使用角度
- **互動式圖表**：可切換的柱狀圖表，支援 6 種不同指標：
  - 成本分析
  - 輸入/輸出 tokens
  - 快取建立/讀取 tokens
  - 訊息數量
- **每小時使用量分析**：提供今日及特定日期的詳細每小時使用分析
- **可展開的月度資料**：點擊「所有時間」中的任何月份檢視每日明細
- **詳細表格**：完整的每日/每月使用量分析，支援向下深入查詢
- **模型分析**：各模型的成本和 token 消耗追蹤

![儀表板預覽](images/dashboard-preview.png)

### 🌐 多語言支援

- **5 種語言**：English, 繁體中文, 简体中文, 日本語, 한국어
- **自動偵測**：自動偵測系統語言
- **手動覆蓋**：在設定中選擇偏好語言

### 🎨 視覺功能

- **由下而上圖表**：符合業界標準的圖表方向
- **月度趨勢**：所有時間檢視顯示月度聚合資料，便於長期趨勢分析
- **VSCode 主題整合**：完美配合亮色/暗色主題
- **響應式設計**：針對不同螢幕尺寸最佳化

## 📥 下載

### VSCode Marketplace
[![VSCode Marketplace](https://img.shields.io/visual-studio-marketplace/v/growthjack.claude-code-usage?style=for-the-badge&logo=visual-studio-code&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=growthjack.claude-code-usage)

### Open VSX Registry（適用於 Cursor / Windsurf / Antigravity）
[![Open VSX](https://img.shields.io/open-vsx/v/GrowthJack/claude-code-usage?style=for-the-badge&logo=eclipseide&label=Open%20VSX%20Registry)](https://marketplace.cursorapi.com/items/?itemName=GrowthJack.claude-code-usage)

## 安裝

1. 從 VSCode 市集安裝擴充功能
2. 擴充功能會自動偵測您的 Claude Code 資料目錄
3. 開始使用 Claude Code，您的使用量會出現在狀態列中

## 設定

透過 `檔案 > 喜好設定 > 設定` 並搜尋「Claude Code Usage」來存取設定：

- **重新整理間隔**：更新使用資料的頻率（最少 30 秒）
- **資料目錄**：自訂 Claude 資料目錄路徑（留空以自動偵測）
- **語言**：顯示語言偏好
- **小數位數**：成本顯示的小數位數

## 🚀 使用方式

### 狀態列

- 顯示**今日使用成本**，附帶脈衝圖示
- 點擊開啟詳細分析儀表板

### 分析儀表板

1. **時間分頁**：在今日、本月和所有時間檢視之間切換
2. **圖表指標**：點擊圖表上方的分頁切換不同指標：
   - 成本分析
   - 輸入/輸出 tokens
   - 快取建立/讀取 tokens
   - 訊息數量
3. **每小時分析**：在「今日」分頁中檢視每小時使用模式
4. **可展開資料**：
   - 點擊「本月」中的每日項目可檢視每小時明細
   - 點擊「所有時間」中的每月項目可檢視每日明細
5. **互動式表格**：圖表下方的詳細每日/每月分析
6. **模型分析**：各分頁中的模型使用統計

![使用流程](images/usage-flow.png)

## 📋 系統需求

- **Claude Code**：必須安裝並執行
- **VSCode**：1.74.0 或更新版本
- **Node.js**：僅使用內建模組（無外部依賴）

## 🛠️ 疑難排解

### 「無 Claude Code 資料」錯誤

1. 確保已安裝並使用過 Claude Code
2. 檢查擴充功能偏好設定中的資料目錄設定
3. 驗證 Claude Code 正在 `~/.claude/projects` 或 `~/.config/claude/projects` 產生使用記錄

### 圖表不更新

1. 切換到不同分頁再切回來重新整理圖表
2. 檢查該時間段是否有實際使用資料
3. 驗證 Claude 使用記錄中是否有快取 tokens

### 效能問題

- 如遇到速度變慢，可增加重新整理間隔
- 擴充功能使用 1 分鐘快取來減少檔案 I/O

## 授權

MIT

## 📝 版本更新日誌

### v1.0.7 (2025-11-28)

- 🌐 新增每小時使用量標籤的多語言翻譯支援
- 🔧 移除程式碼中硬編碼的中文文字，改用 i18n 翻譯系統
- ✨ 確保使用者界面的多語言一致性（英文、繁體中文、简体中文、日文、韓文）

### v1.0.6 (2025-08-10)

- 🆕 新增 Claude Opus 4.1 模型訂價支援
- 🔄 更新訂價資料以包含 `claude-opus-4-1-20250805` 和 `claude-opus-4-1` 模型 ID
- 📊 訂價與 Opus 4 相同（$15/1M 輸入，$75/1M 輸出 tokens）

### v1.0.5 (2025-07)

- ⏰ 新增每小時使用量統計與視覺化
- 📈 增強儀表板的每小時細分功能
- 🔧 改善每小時彙總的資料處理

### v1.0.4 (2025-07)

- 📊 新增全時間資料計算功能
- 🎨 更新 UI 以顯示全時間使用資料與圖表和標籤
- 🔄 修正資料更新邏輯以支援新資料結構
- 🌐 在多語言支援中新增「全時間」翻譯

### v1.0.3 (2025-07)

- 🔗 更新 GitHub 儲存庫 URL
- 🖼️ 修正 README 圖片連結指向新儲存庫位置
- 📦 版本升級與儲存庫遷移

### v1.0.0 (2025-07)

- 🎉 首次完整發行版
- 📊 狀態列即時 Claude Code 使用量監控
- 🌐 多語言支援（English, 繁體中文, 简体中文, 日本語, 한국어）
- 📈 互動式分析儀表板與圖表和表格
- 🎨 VSCode 主題整合與響應式設計
- ⚙️ 可設定的重新整理間隔與設定

## 貢獻

歡迎在 GitHub 儲存庫提出 Issue 和 Pull Request。
