import * as vscode from 'vscode';
import { UsageData, SessionData } from './types';
import { I18n } from './i18n';

export class UsageWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private currentSessionData: SessionData | null = null;
  private todayData: UsageData | null = null;
  private monthData: UsageData | null = null;
  private dailyDataForMonth: { date: string; data: UsageData }[] = [];
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
    dailyDataForMonth: { date: string; data: UsageData }[] = [],
    error?: string,
    dataDirectory?: string | null
  ): void {
    this.currentSessionData = sessionData;
    this.todayData = todayData;
    this.monthData = monthData;
    this.dailyDataForMonth = dailyDataForMonth;
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
          </div>

          <div id="today" class="tab-content ${this.currentTab === 'today' ? 'active' : ''}">
            ${this.renderUsageData(this.todayData)}
          </div>

          <div id="month" class="tab-content ${this.currentTab === 'month' ? 'active' : ''}">
            ${this.renderMonthData()}
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

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time for comparison
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (dateOnly.getTime() === todayOnly.getTime()) {
      return `${I18n.t.popup.today} (${date.toLocaleDateString()})`;
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return `${I18n.t.popup.yesterday} (${date.toLocaleDateString()})`;
    } else {
      return date.toLocaleDateString();
    }
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
        
        // Notify the extension about tab change
        vscode.postMessage({ command: 'tabChanged', tab: tabName });
      }
    `;
  }

  dispose(): void {
    if (this.panel) {
      this.panel.dispose();
    }
  }
}