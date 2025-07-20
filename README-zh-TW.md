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
- **詳細表格**：完整的每日/每月使用量分析
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
3. **互動式表格**：圖表下方的詳細每日/每月分析
4. **模型分析**：各分頁中的模型使用統計

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

## 貢獻

歡迎在 GitHub 儲存庫提出 Issue 和 Pull Request。