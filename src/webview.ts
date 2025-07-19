import * as vscode from 'vscode';
import { UsageData, SessionData } from './types';
import { I18n } from './i18n';

export class UsageWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private currentSessionData: SessionData | null = null;
  private todayData: UsageData | null = null;
  private monthData: UsageData | null = null;
  private allTimeData: UsageData | null = null;
  private dailyDataForMonth: { date: string; data: UsageData }[] = [];
  private dailyDataForAllTime: { date: string; data: UsageData }[] = [];
  private isLoading: boolean = false;
  private error: string | null = null;
  private dataDirectory: string | null = null;
  private currentTab: string = 'today';

  constructor(private context: vscode.ExtensionContext) {}

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'claudeCodeUsage',
      I18n.t.popup.title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'refresh':
          vscode.commands.executeCommand('claudeCodeUsage.refresh');
          break;
        case 'openSettings':
          vscode.commands.executeCommand('claudeCodeUsage.openSettings');
          break;
        case 'tabChanged':
          this.currentTab = message.tab;
          break;
      }
    });

    this.updateWebview();
  }

  updateData(
    sessionData: SessionData | null,
    todayData: UsageData | null,
    monthData: UsageData | null,
    allTimeData: UsageData | null,
    dailyDataForMonth: { date: string; data: UsageData }[] = [],
    dailyDataForAllTime: { date: string; data: UsageData }[] = [],
    error?: string,
    dataDirectory?: string | null
  ): void {
    this.currentSessionData = sessionData;
    this.todayData = todayData;
    this.monthData = monthData;
    this.allTimeData = allTimeData;
    this.dailyDataForMonth = dailyDataForMonth;
    this.dailyDataForAllTime = dailyDataForAllTime;
    this.error = error || null;
    this.dataDirectory = dataDirectory || null;
    this.isLoading = false;

    if (this.panel) {
      this.updateWebview();
    }
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
    if (this.panel) {
      this.updateWebview();
    }
  }

  private updateWebview(): void {
    if (!this.panel) return;

    this.panel.webview.html = this.getWebviewContent();
  }

  private getWebviewContent(): string {
    if (this.isLoading) {
      return this.getLoadingContent();
    }

    if (this.error) {
      return this.getErrorContent();
    }

    if (!this.currentSessionData && !this.todayData && !this.monthData) {
      return this.getNoDataContent();
    }

    return this.getMainContent();
  }

  private getLoadingContent(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${I18n.t.popup.title}</title>
        <style>${this.getStyles()}</style>
      </head>
      <body>
        <div class="container">
          <div class="loading">
            <div class="spinner"></div>
            <p>${I18n.t.statusBar.loading}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getErrorContent(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${I18n.t.popup.title}</title>
        <style>${this.getStyles()}</style>
      </head>
      <body>
        <div class="container">
          <div class="error">
            <h2>${I18n.t.statusBar.error}</h2>
            <p>${this.error}</p>
            <button onclick="refresh()">${I18n.t.popup.refresh}</button>
          </div>
        </div>
        <script>${this.getScript()}</script>
      </body>
      </html>
    `;
  }

  private getNoDataContent(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${I18n.t.popup.title}</title>
        <style>${this.getStyles()}</style>
      </head>
      <body>
        <div class="container">
          <div class="no-data">
            <h2>${I18n.t.statusBar.noData}</h2>
            <p>${I18n.t.popup.noDataMessage}</p>
            <div class="actions">
              <button onclick="refresh()">${I18n.t.popup.refresh}</button>
              <button onclick="openSettings()">${I18n.t.popup.settings}</button>
            </div>
          </div>
        </div>
        <script>${this.getScript()}</script>
      </body>
      </html>
    `;
  }

  private getMainContent(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${I18n.t.popup.title}</title>
        <style>${this.getStyles()}</style>
      </head>
      <body>
        <div class="container">
          <header>
            <h1>${I18n.t.popup.title}</h1>
            <div class="actions">
              <button onclick="refresh()" class="btn-secondary">${I18n.t.popup.refresh}</button>
              <button onclick="openSettings()" class="btn-secondary">${I18n.t.popup.settings}</button>
            </div>
          </header>

          <div class="tabs">
            <button class="tab ${this.currentTab === 'today' ? 'active' : ''}" onclick="showTab('today')">${I18n.t.popup.today}</button>
            <button class="tab ${this.currentTab === 'month' ? 'active' : ''}" onclick="showTab('month')">${I18n.t.popup.thisMonth}</button>
            <button class="tab ${this.currentTab === 'all' ? 'active' : ''}" onclick="showTab('all')">${I18n.t.popup.allTime}</button>
          </div>

          <div id="today" class="tab-content ${this.currentTab === 'today' ? 'active' : ''}">
            ${this.renderUsageData(this.todayData)}
          </div>

          <div id="month" class="tab-content ${this.currentTab === 'month' ? 'active' : ''}">
            ${this.renderMonthData()}
          </div>

          <div id="all" class="tab-content ${this.currentTab === 'all' ? 'active' : ''}">
            ${this.renderAllTimeData()}
          </div>
        </div>
        <script>${this.getScript()}</script>
      </body>
      </html>
    `;
  }

  private renderUsageData(data: UsageData | null): string {
    if (!data) {
      return `<div class="no-data"><p>${I18n.t.popup.noDataMessage}</p></div>`;
    }

    return `
      <div class="usage-summary">
        <div class="summary-grid">
          <div class="summary-item">
            <div class="label">${I18n.t.popup.cost}</div>
            <div class="value cost">${I18n.formatCurrency(data.totalCost)}</div>
          </div>
          <div class="summary-item">
            <div class="label">${I18n.t.popup.messages}</div>
            <div class="value">${I18n.formatNumber(data.messageCount)}</div>
          </div>
          <div class="summary-item">
            <div class="label">${I18n.t.popup.inputTokens}</div>
            <div class="value">${I18n.formatNumber(data.totalInputTokens)}</div>
          </div>
          <div class="summary-item">
            <div class="label">${I18n.t.popup.outputTokens}</div>
            <div class="value">${I18n.formatNumber(data.totalOutputTokens)}</div>
          </div>
          <div class="summary-item">
            <div class="label">${I18n.t.popup.cacheCreation}</div>
            <div class="value">${I18n.formatNumber(data.totalCacheCreationTokens)}</div>
          </div>
          <div class="summary-item">
            <div class="label">${I18n.t.popup.cacheRead}</div>
            <div class="value">${I18n.formatNumber(data.totalCacheReadTokens)}</div>
          </div>
        </div>
      </div>

      ${Object.keys(data.modelBreakdown).length > 0 ? `
        <div class="model-breakdown">
          <h3>${I18n.t.popup.modelBreakdown}</h3>
          <div class="model-list">
            ${Object.entries(data.modelBreakdown).map(([model, modelData]) => `
              <div class="model-item">
                <div class="model-header">
                  <span class="model-name">${this.escapeHtml(model)}</span>
                  <span class="model-cost">${I18n.formatCurrency(modelData.cost)}</span>
                </div>
                <div class="model-details">
                  <span>${I18n.t.popup.inputTokens}: ${I18n.formatNumber(modelData.inputTokens)}</span>
                  <span>${I18n.t.popup.outputTokens}: ${I18n.formatNumber(modelData.outputTokens)}</span>
                  <span>${I18n.t.popup.cacheCreation}: ${I18n.formatNumber(modelData.cacheCreationTokens)}</span>
                  <span>${I18n.t.popup.cacheRead}: ${I18n.formatNumber(modelData.cacheReadTokens)}</span>
                  <span>${I18n.t.popup.messages}: ${I18n.formatNumber(modelData.count)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  private renderMonthData(): string {
    if (!this.monthData) {
      return `<div class="no-data"><p>${I18n.t.popup.noDataMessage}</p></div>`;
    }

    const monthSummary = this.renderUsageData(this.monthData);
    
    const dailyBreakdown = this.dailyDataForMonth.length > 0 ? `
      <div class="daily-breakdown">
        <h3>${I18n.t.popup.dailyBreakdown}</h3>
        
        <!-- Chart Tabs -->
        <div class="chart-tabs">
          <button class="chart-tab active" data-metric="cost">${I18n.t.popup.cost}</button>
          <button class="chart-tab" data-metric="inputTokens">${I18n.t.popup.inputTokens}</button>
          <button class="chart-tab" data-metric="outputTokens">${I18n.t.popup.outputTokens}</button>
          <button class="chart-tab" data-metric="cacheCreation">${I18n.t.popup.cacheCreation}</button>
          <button class="chart-tab" data-metric="cacheRead">${I18n.t.popup.cacheRead}</button>
          <button class="chart-tab" data-metric="messages">${I18n.t.popup.messages}</button>
        </div>
        
        <!-- Chart Container -->
        <div class="chart-container">
          <div class="chart-content" id="dailyChart">
            ${this.renderDailyChart()}
          </div>
        </div>
        
        <div class="daily-table-container">
          <table class="daily-table">
            <thead>
              <tr>
                <th>${I18n.t.popup.date}</th>
                <th>${I18n.t.popup.cost}</th>
                <th>${I18n.t.popup.inputTokens}</th>
                <th>${I18n.t.popup.outputTokens}</th>
                <th>${I18n.t.popup.cacheCreation}</th>
                <th>${I18n.t.popup.cacheRead}</th>
                <th>${I18n.t.popup.messages}</th>
              </tr>
            </thead>
            <tbody>
              ${this.dailyDataForMonth.map(({ date, data }) => `
                <tr>
                  <td class="date-cell">${this.formatDate(date)}</td>
                  <td class="cost-cell">${I18n.formatCurrency(data.totalCost)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalInputTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalOutputTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalCacheCreationTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalCacheReadTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.messageCount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : '';

    return monthSummary + dailyBreakdown;
  }

  private renderAllTimeData(): string {
    if (!this.allTimeData) {
      return `<div class="no-data"><p>${I18n.t.popup.noDataMessage}</p></div>`;
    }

    const allTimeSummary = this.renderUsageData(this.allTimeData);
    
    const dailyBreakdown = this.dailyDataForAllTime.length > 0 ? `
      <div class="daily-breakdown">
        <h3>${I18n.t.popup.dailyBreakdown}</h3>
        
        <!-- Chart Tabs -->
        <div class="chart-tabs">
          <button class="chart-tab active" data-metric="cost">${I18n.t.popup.cost}</button>
          <button class="chart-tab" data-metric="inputTokens">${I18n.t.popup.inputTokens}</button>
          <button class="chart-tab" data-metric="outputTokens">${I18n.t.popup.outputTokens}</button>
          <button class="chart-tab" data-metric="cacheCreation">${I18n.t.popup.cacheCreation}</button>
          <button class="chart-tab" data-metric="cacheRead">${I18n.t.popup.cacheRead}</button>
          <button class="chart-tab" data-metric="messages">${I18n.t.popup.messages}</button>
        </div>
        
        <!-- Chart Container -->
        <div class="chart-container">
          <div class="chart-content" id="allTimeChart">
            ${this.renderAllTimeChart()}
          </div>
        </div>
        
        <div class="daily-table-container">
          <table class="daily-table">
            <thead>
              <tr>
                <th>${I18n.t.popup.date}</th>
                <th>${I18n.t.popup.cost}</th>
                <th>${I18n.t.popup.inputTokens}</th>
                <th>${I18n.t.popup.outputTokens}</th>
                <th>${I18n.t.popup.cacheCreation}</th>
                <th>${I18n.t.popup.cacheRead}</th>
                <th>${I18n.t.popup.messages}</th>
              </tr>
            </thead>
            <tbody>
              ${this.dailyDataForAllTime.map(({ date, data }) => `
                <tr>
                  <td class="date-cell">${this.formatDate(date)}</td>
                  <td class="cost-cell">${I18n.formatCurrency(data.totalCost)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalInputTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalOutputTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalCacheCreationTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalCacheReadTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.messageCount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : '';

    return allTimeSummary + dailyBreakdown;
  }

  private renderDailyChart(): string {
    if (this.dailyDataForMonth.length === 0) {
      return '<div class="no-chart-data">No data available</div>';
    }

    // Sort data by date (oldest first for chart display)
    const sortedData = [...this.dailyDataForMonth].sort((a, b) => a.date.localeCompare(b.date));
    
    // Generate chart bars for cost (default metric)
    const maxCost = Math.max(...sortedData.map(d => d.data.totalCost));
    const maxHeight = 120; // Max height in pixels
    
    return `
      <div class="chart-bars">
        ${sortedData.map(({ date, data }) => {
          const height = maxCost > 0 ? (data.totalCost / maxCost) * maxHeight : 0;
          return `
            <div class="chart-bar-container" data-date="${date}">
              <div class="chart-bar cost-bar" 
                   style="height: ${height}px;"
                   data-cost="${data.totalCost}"
                   data-input="${data.totalInputTokens}"
                   data-output="${data.totalOutputTokens}"
                   data-cache-creation="${data.totalCacheCreationTokens}"
                   data-cache-read="${data.totalCacheReadTokens}"
                   data-messages="${data.messageCount}"
                   title="${this.formatDate(date)}: ${I18n.formatCurrency(data.totalCost)}">
              </div>
              <div class="chart-label">${this.getShortDate(date)}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private renderAllTimeChart(): string {
    if (this.dailyDataForAllTime.length === 0) {
      return '<div class="no-chart-data">No data available</div>';
    }

    // Sort data by date (oldest first for chart display)
    const sortedData = [...this.dailyDataForAllTime].sort((a, b) => a.date.localeCompare(b.date));
    
    // Generate chart bars for cost (default metric)
    const maxCost = Math.max(...sortedData.map(d => d.data.totalCost));
    const maxHeight = 120; // Max height in pixels
    
    return `
      <div class="chart-bars">
        ${sortedData.map(({ date, data }) => {
          const height = maxCost > 0 ? (data.totalCost / maxCost) * maxHeight : 0;
          return `
            <div class="chart-bar-container" data-date="${date}">
              <div class="chart-bar cost-bar" 
                   style="height: ${height}px;"
                   data-cost="${data.totalCost}"
                   data-input="${data.totalInputTokens}"
                   data-output="${data.totalOutputTokens}"
                   data-cache-creation="${data.totalCacheCreationTokens}"
                   data-cache-read="${data.totalCacheReadTokens}"
                   data-messages="${data.messageCount}"
                   title="${this.formatDate(date)}: ${I18n.formatCurrency(data.totalCost)}">
              </div>
              <div class="chart-label">${this.getShortDate(date)}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private getShortDate(dateString: string): string {
    const date = new Date(dateString);
    // Check if this is a month-only date (ends with -01)
    if (dateString.endsWith('-01')) {
      // Format as YYYY/MM for monthly data
      return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    // Format as MM/DD for daily data
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    // Check if this is a month-only date (ends with -01)
    if (dateString.endsWith('-01')) {
      // Format as YYYY年MM月 for monthly data
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      return `${year}年${month}月`;
    }
    // Standard date formatting for daily data
    return date.toLocaleDateString();
  }


  private getStyles(): string {
    return `
      body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-background);
        margin: 0;
        padding: 16px;
      }

      .container {
        max-width: 600px;
        margin: 0 auto;
      }

      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        border-bottom: 1px solid var(--vscode-panel-border);
        padding-bottom: 16px;
      }


      h1 {
        margin: 0;
        font-size: 20px;
      }

      .actions {
        display: flex;
        gap: 8px;
      }

      button {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 12px;
      }

      button:hover {
        background: var(--vscode-button-hoverBackground);
      }

      .btn-secondary {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }

      .btn-secondary:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }

      .tabs {
        display: flex;
        margin-bottom: 20px;
        border-bottom: 1px solid var(--vscode-panel-border);
      }

      .tab {
        background: transparent;
        border: none;
        padding: 8px 16px;
        cursor: pointer;
        border-bottom: 2px solid transparent;
      }

      .tab.active {
        border-bottom-color: var(--vscode-focusBorder);
        color: var(--vscode-focusBorder);
      }

      .tab-content {
        display: none;
      }

      .tab-content.active {
        display: block;
      }

      .usage-summary {
        margin-bottom: 24px;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
      }

      .summary-item {
        text-align: center;
        padding: 16px;
        background: var(--vscode-input-background);
        border-radius: 8px;
        border: 1px solid var(--vscode-input-border);
      }

      .summary-item .label {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 8px;
      }

      .summary-item .value {
        font-size: 18px;
        font-weight: bold;
      }

      .summary-item .value.cost {
        color: var(--vscode-charts-green);
      }

      .model-breakdown, .daily-breakdown {
        margin-top: 24px;
      }

      .model-breakdown h3, .daily-breakdown h3 {
        margin-bottom: 16px;
        font-size: 16px;
      }

      .model-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .model-item {
        padding: 12px;
        background: var(--vscode-input-background);
        border-radius: 6px;
        border: 1px solid var(--vscode-input-border);
      }

      .model-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .model-name {
        font-weight: bold;
        color: var(--vscode-symbolIcon-functionForeground);
      }

      .model-cost {
        font-weight: bold;
        color: var(--vscode-charts-green);
      }

      .model-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 8px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }

      .chart-tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .chart-tab {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .chart-tab:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }

      .chart-tab.active {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-color: var(--vscode-focusBorder);
      }

      .chart-container {
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
        height: 180px;
        overflow-x: auto;
      }

      .chart-content {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: end;
        justify-content: center;
      }

      .chart-bars {
        display: flex;
        align-items: end;
        gap: 4px;
        min-width: fit-content;
        height: 100%;
        padding: 0 8px;
      }

      .chart-bar-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        min-width: 40px;
        height: 100%;
        position: relative;
        padding-bottom: 20px;
      }

      .chart-bar {
        width: 24px;
        min-height: 2px;
        border-radius: 2px 2px 0 0;
        transition: all 0.3s ease;
        cursor: pointer;
        margin-bottom: 8px;
      }

      .chart-bar:hover {
        opacity: 0.8;
        transform: scaleY(1.05);
      }

      .cost-bar {
        background: linear-gradient(to top, var(--vscode-charts-green), var(--vscode-charts-blue));
      }

      .input-bar {
        background: linear-gradient(to top, var(--vscode-charts-blue), var(--vscode-charts-purple));
      }

      .output-bar {
        background: linear-gradient(to top, var(--vscode-charts-orange), var(--vscode-charts-red));
      }

      .cache-creation-bar {
        background: linear-gradient(to top, var(--vscode-charts-purple), var(--vscode-charts-pink));
      }

      .cache-read-bar {
        background: linear-gradient(to top, var(--vscode-charts-yellow), var(--vscode-charts-orange));
      }

      .messages-bar {
        background: linear-gradient(to top, var(--vscode-charts-foreground), var(--vscode-charts-lines));
      }

      .chart-label {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        text-align: center;
        word-break: break-all;
        line-height: 12px;
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 100%;
      }

      .no-chart-data {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
      }

      .daily-table-container {
        overflow-x: auto;
        margin-top: 12px;
      }

      .daily-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }

      .daily-table th,
      .daily-table td {
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid var(--vscode-panel-border);
      }

      .daily-table th {
        background: var(--vscode-input-background);
        font-weight: bold;
        color: var(--vscode-foreground);
        position: sticky;
        top: 0;
      }

      .daily-table tbody tr:hover {
        background: var(--vscode-list-hoverBackground);
      }

      .date-cell {
        font-weight: bold;
        color: var(--vscode-symbolIcon-functionForeground);
        white-space: nowrap;
      }

      .cost-cell {
        font-weight: bold;
        color: var(--vscode-charts-green);
        text-align: right;
      }

      .number-cell {
        text-align: right;
        font-family: var(--vscode-editor-font-family);
      }

      .loading, .error, .no-data {
        text-align: center;
        padding: 40px 20px;
      }

      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--vscode-progressBar-background);
        border-top: 3px solid var(--vscode-focusBorder);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .error {
        color: var(--vscode-errorForeground);
      }

      .no-data {
        color: var(--vscode-descriptionForeground);
      }
    `;
  }

  private getScript(): string {
    return `
      const vscode = acquireVsCodeApi();

      function refresh() {
        vscode.postMessage({ command: 'refresh' });
      }

      function openSettings() {
        vscode.postMessage({ command: 'openSettings' });
      }

      function showTab(tabName) {
        // Remove active class from all tabs and tab contents
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        event.target.classList.add('active');
        document.getElementById(tabName).classList.add('active');
        
        // Re-initialize chart for the new active tab
        setTimeout(() => {
          const activeTab = document.querySelector('.chart-tab.active');
          const metric = activeTab ? activeTab.dataset.metric : 'cost';
          updateChart(metric);
        }, 100);
        
        // Notify the extension about tab change
        vscode.postMessage({ command: 'tabChanged', tab: tabName });
      }

      // Chart functionality
      function updateChart(metric) {
        // Only update charts in the active tab
        const activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) return;
        
        const chartBars = activeTab.querySelectorAll('.chart-bar');
        const maxValues = {
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreation: 0,
          cacheRead: 0,
          messages: 0
        };

        // Find max values for each metric
        chartBars.forEach(bar => {
          maxValues.cost = Math.max(maxValues.cost, parseFloat(bar.dataset.cost) || 0);
          maxValues.inputTokens = Math.max(maxValues.inputTokens, parseFloat(bar.dataset.input) || 0);
          maxValues.outputTokens = Math.max(maxValues.outputTokens, parseFloat(bar.dataset.output) || 0);
          maxValues.cacheCreation = Math.max(maxValues.cacheCreation, parseFloat(bar.dataset.cacheCreation) || 0);
          maxValues.cacheRead = Math.max(maxValues.cacheRead, parseFloat(bar.dataset.cacheRead) || 0);
          maxValues.messages = Math.max(maxValues.messages, parseFloat(bar.dataset.messages) || 0);
        });

        const maxHeight = 120;
        const maxValue = maxValues[metric];

        // Update bar heights and styles
        chartBars.forEach(bar => {
          let value = 0;
          let barClass = 'cost-bar';
          let formattedValue = '';

          switch(metric) {
            case 'cost':
              value = parseFloat(bar.dataset.cost) || 0;
              barClass = 'cost-bar';
              formattedValue = '$' + value.toFixed(2);
              break;
            case 'inputTokens':
              value = parseFloat(bar.dataset.input) || 0;
              barClass = 'input-bar';
              formattedValue = value.toLocaleString();
              break;
            case 'outputTokens':
              value = parseFloat(bar.dataset.output) || 0;
              barClass = 'output-bar';
              formattedValue = value.toLocaleString();
              break;
            case 'cacheCreation':
              value = parseFloat(bar.dataset.cacheCreation) || 0;
              barClass = 'cache-creation-bar';
              formattedValue = value.toLocaleString();
              break;
            case 'cacheRead':
              value = parseFloat(bar.dataset.cacheRead) || 0;
              barClass = 'cache-read-bar';
              formattedValue = value.toLocaleString();
              break;
            case 'messages':
              value = parseFloat(bar.dataset.messages) || 0;
              barClass = 'messages-bar';
              formattedValue = value.toLocaleString();
              break;
          }

          const height = maxValue > 0 ? (value / maxValue) * maxHeight : 2;
          bar.style.height = height + 'px';
          bar.className = 'chart-bar ' + barClass;
          
          // Update tooltip
          const container = bar.parentElement;
          const date = container.dataset.date;
          const dateObj = new Date(date);
          bar.title = dateObj.toLocaleDateString() + ': ' + formattedValue;
        });
      }

      // Initialize chart functionality when DOM is loaded
      document.addEventListener('DOMContentLoaded', function() {
        // Chart tab click handlers
        document.querySelectorAll('.chart-tab').forEach(tab => {
          tab.addEventListener('click', function() {
            // Remove active class from all chart tabs
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            // Update chart
            const metric = this.dataset.metric;
            updateChart(metric);
          });
        });

        // Initialize with cost metric
        updateChart('cost');
      });
    `;
  }

  dispose(): void {
    if (this.panel) {
      this.panel.dispose();
    }
  }
}