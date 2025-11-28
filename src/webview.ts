import * as vscode from 'vscode';
import { I18n } from './i18n';
import { SessionData, UsageData } from './types';

export class UsageWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private currentSessionData: SessionData | null = null;
  private todayData: UsageData | null = null;
  private monthData: UsageData | null = null;
  private allTimeData: UsageData | null = null;
  private dailyDataForMonth: { date: string; data: UsageData }[] = [];
  private dailyDataForAllTime: { date: string; data: UsageData }[] = [];
  private hourlyDataForToday: { hour: string; data: UsageData }[] = [];
  private isLoading: boolean = false;
  private error: string | null = null;
  private dataDirectory: string | null = null;
  private currentTab: string = 'today';
  private hourlyDataCache: Map<string, { hour: string; data: UsageData }[]> = new Map();
  private allRecords: any[] = [];

  constructor(private context: vscode.ExtensionContext) {}

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel('claudeCodeUsage', I18n.t.popup.title, vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (message) => {
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
        case 'getHourlyData':
          const dateString = message.date;
          if (dateString && this.panel) {
            // Get hourly data for the specified date
            const { ClaudeDataLoader } = await import('./dataLoader');
            const hourlyData = ClaudeDataLoader.getHourlyDataForDate(this.allRecords, dateString);

            // Send data back to webview
            this.panel.webview.postMessage({
              command: 'hourlyDataResponse',
              date: dateString,
              data: hourlyData,
            });
          }
          break;
        case 'getDailyData':
          const monthString = message.month;
          if (monthString && this.panel) {
            // Get daily data for the specified month
            const { ClaudeDataLoader } = await import('./dataLoader');
            const dailyData = ClaudeDataLoader.getDailyDataForSpecificMonth(this.allRecords, monthString);

            // Send data back to webview
            this.panel.webview.postMessage({
              command: 'dailyDataResponse',
              month: monthString,
              data: dailyData,
            });
          }
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
    hourlyDataForToday: { hour: string; data: UsageData }[] = [],
    error?: string,
    dataDirectory?: string | null,
    allRecords?: any[]
  ): void {
    this.currentSessionData = sessionData;
    this.todayData = todayData;
    this.monthData = monthData;
    this.allTimeData = allTimeData;
    this.dailyDataForMonth = dailyDataForMonth;
    this.dailyDataForAllTime = dailyDataForAllTime;
    this.hourlyDataForToday = hourlyDataForToday;
    this.error = error || null;
    this.dataDirectory = dataDirectory || null;
    this.isLoading = false;
    if (allRecords) {
      this.allRecords = allRecords;
    }

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
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
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
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
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
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
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
    // Pre-resolve I18n values to avoid template literal issues
    const title = I18n.t.popup.title;
    const refresh = I18n.t.popup.refresh;
    const settings = I18n.t.popup.settings;
    const today = I18n.t.popup.today;
    const thisMonth = I18n.t.popup.thisMonth;
    const allTime = I18n.t.popup.allTime;

    const todayActive = this.currentTab === 'today' ? 'active' : '';
    const monthActive = this.currentTab === 'month' ? 'active' : '';
    const allActive = this.currentTab === 'all' ? 'active' : '';

    return (
      `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
        <title>` +
      title +
      `</title>
        <style>` +
      this.getStyles() +
      `</style>
      </head>
      <body>
        <div class="container">
          <header>
            <h1>` +
      title +
      `</h1>
            <div class="actions">
              <button onclick="refresh()" class="btn-secondary">` +
      refresh +
      `</button>
              <button onclick="openSettings()" class="btn-secondary">` +
      settings +
      `</button>
            </div>
          </header>

          <div class="tabs">
            <button id="tab-today" class="tab ` +
      todayActive +
      `" onclick="showTab('today')">` +
      today +
      `</button>
            <button id="tab-month" class="tab ` +
      monthActive +
      `" onclick="showTab('month')">` +
      thisMonth +
      `</button>
            <button id="tab-all" class="tab ` +
      allActive +
      `" onclick="showTab('all')">` +
      allTime +
      `</button>
          </div>

          <div id="today" class="tab-content ` +
      todayActive +
      `">
            ` +
      this.renderTodayData() +
      `
          </div>

          <div id="month" class="tab-content ` +
      monthActive +
      `">
            ` +
      this.renderMonthData() +
      `
          </div>

          <div id="all" class="tab-content ` +
      allActive +
      `">
            ` +
      this.renderAllTimeData() +
      `
          </div>
        </div>
        <script>` +
      this.getScript() +
      `</script>
      </body>
      </html>
    `
    );
  }

  private renderTodayData(): string {
    if (!this.todayData) {
      return '<div class="no-data"><p>' + I18n.t.popup.noDataMessage + '</p></div>';
    }

    const todaySummary = this.renderUsageData(this.todayData);

    let hourlyBreakdown = '';
    if (this.hourlyDataForToday.length > 0) {
      const cost = I18n.t.popup.cost;
      const inputTokens = I18n.t.popup.inputTokens;
      const outputTokens = I18n.t.popup.outputTokens;
      const cacheCreation = I18n.t.popup.cacheCreation;
      const cacheRead = I18n.t.popup.cacheRead;
      const messages = I18n.t.popup.messages;

      let hourlyRows = '';
      this.hourlyDataForToday.forEach(({ hour, data }) => {
        hourlyRows +=
          '<tr>' +
          '<td class="date-cell">' +
          hour +
          '</td>' +
          '<td class="cost-cell">' +
          I18n.formatCurrency(data.totalCost) +
          '</td>' +
          '<td class="number-cell">' +
          I18n.formatNumber(data.totalInputTokens) +
          '</td>' +
          '<td class="number-cell">' +
          I18n.formatNumber(data.totalOutputTokens) +
          '</td>' +
          '<td class="number-cell">' +
          I18n.formatNumber(data.totalCacheCreationTokens) +
          '</td>' +
          '<td class="number-cell">' +
          I18n.formatNumber(data.totalCacheReadTokens) +
          '</td>' +
          '<td class="number-cell">' +
          I18n.formatNumber(data.messageCount) +
          '</td>' +
          '</tr>';
      });

      hourlyBreakdown =
        '<div class="daily-breakdown">' +
        '<h3>' +
        I18n.t.popup.hourlyBreakdown +
        '</h3>' +
        '<div class="chart-tabs">' +
        '<button class="chart-tab active" data-metric="cost">' +
        cost +
        '</button>' +
        '<button class="chart-tab" data-metric="inputTokens">' +
        inputTokens +
        '</button>' +
        '<button class="chart-tab" data-metric="outputTokens">' +
        outputTokens +
        '</button>' +
        '<button class="chart-tab" data-metric="cacheCreation">' +
        cacheCreation +
        '</button>' +
        '<button class="chart-tab" data-metric="cacheRead">' +
        cacheRead +
        '</button>' +
        '<button class="chart-tab" data-metric="messages">' +
        messages +
        '</button>' +
        '</div>' +
        '<div class="chart-container">' +
        '<div class="chart-content" id="hourlyChart">' +
        this.renderHourlyChart() +
        '</div>' +
        '</div>' +
        '<div class="daily-table-container">' +
        '<table class="daily-table">' +
        '<thead>' +
        '<tr>' +
        '<th>時間</th>' +
        '<th>' +
        cost +
        '</th>' +
        '<th>' +
        inputTokens +
        '</th>' +
        '<th>' +
        outputTokens +
        '</th>' +
        '<th>' +
        cacheCreation +
        '</th>' +
        '<th>' +
        cacheRead +
        '</th>' +
        '<th>' +
        messages +
        '</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' +
        hourlyRows +
        '</tbody>' +
        '</table>' +
        '</div>' +
        '</div>';
    }

    return todaySummary + hourlyBreakdown;
  }

  private renderUsageData(data: UsageData | null): string {
    if (!data) {
      return '<div class="no-data"><p>' + I18n.t.popup.noDataMessage + '</p></div>';
    }

    const cost = I18n.t.popup.cost;
    const messages = I18n.t.popup.messages;
    const inputTokens = I18n.t.popup.inputTokens;
    const outputTokens = I18n.t.popup.outputTokens;
    const cacheCreation = I18n.t.popup.cacheCreation;
    const cacheRead = I18n.t.popup.cacheRead;
    const modelBreakdown = I18n.t.popup.modelBreakdown;

    let html =
      '<div class="usage-summary">' +
      '<div class="summary-grid">' +
      '<div class="summary-item">' +
      '<div class="label">' +
      cost +
      '</div>' +
      '<div class="value cost">' +
      I18n.formatCurrency(data.totalCost) +
      '</div>' +
      '</div>' +
      '<div class="summary-item">' +
      '<div class="label">' +
      messages +
      '</div>' +
      '<div class="value">' +
      I18n.formatNumber(data.messageCount) +
      '</div>' +
      '</div>' +
      '<div class="summary-item">' +
      '<div class="label">' +
      inputTokens +
      '</div>' +
      '<div class="value">' +
      I18n.formatNumber(data.totalInputTokens) +
      '</div>' +
      '</div>' +
      '<div class="summary-item">' +
      '<div class="label">' +
      outputTokens +
      '</div>' +
      '<div class="value">' +
      I18n.formatNumber(data.totalOutputTokens) +
      '</div>' +
      '</div>' +
      '<div class="summary-item">' +
      '<div class="label">' +
      cacheCreation +
      '</div>' +
      '<div class="value">' +
      I18n.formatNumber(data.totalCacheCreationTokens) +
      '</div>' +
      '</div>' +
      '<div class="summary-item">' +
      '<div class="label">' +
      cacheRead +
      '</div>' +
      '<div class="value">' +
      I18n.formatNumber(data.totalCacheReadTokens) +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>';

    if (Object.keys(data.modelBreakdown).length > 0) {
      html += '<div class="model-breakdown">' + '<h3>' + modelBreakdown + '</h3>' + '<div class="model-list">';

      Object.entries(data.modelBreakdown).forEach(([model, modelData]) => {
        html +=
          '<div class="model-item">' +
          '<div class="model-header">' +
          '<span class="model-name">' +
          this.escapeHtml(model) +
          '</span>' +
          '<span class="model-cost">' +
          I18n.formatCurrency(modelData.cost) +
          '</span>' +
          '</div>' +
          '<div class="model-details">' +
          '<span>' +
          inputTokens +
          ': ' +
          I18n.formatNumber(modelData.inputTokens) +
          '</span>' +
          '<span>' +
          outputTokens +
          ': ' +
          I18n.formatNumber(modelData.outputTokens) +
          '</span>' +
          '<span>' +
          cacheCreation +
          ': ' +
          I18n.formatNumber(modelData.cacheCreationTokens) +
          '</span>' +
          '<span>' +
          cacheRead +
          ': ' +
          I18n.formatNumber(modelData.cacheReadTokens) +
          '</span>' +
          '<span>' +
          messages +
          ': ' +
          I18n.formatNumber(modelData.count) +
          '</span>' +
          '</div>' +
          '</div>';
      });

      html += '</div></div>';
    }

    return html;
  }

  private renderMonthData(): string {
    if (!this.monthData) {
      return `<div class="no-data"><p>${I18n.t.popup.noDataMessage}</p></div>`;
    }

    const monthSummary = this.renderUsageData(this.monthData);

    const dailyBreakdown =
      this.dailyDataForMonth.length > 0
        ? `
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${this.dailyDataForMonth
                .map(
                  ({ date, data }) => `
                <tr class="daily-row" data-date="${date}">
                  <td class="date-cell">${this.formatDate(date)}</td>
                  <td class="cost-cell">${I18n.formatCurrency(data.totalCost)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalInputTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalOutputTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalCacheCreationTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalCacheReadTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.messageCount)}</td>
                  <td class="detail-cell">
                    <button class="detail-button" onclick="toggleHourlyDetail('${date}')" title="顯示每小時詳細資料">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path class="expand-icon" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                      </svg>
                    </button>
                  </td>
                </tr>
                <tr class="hourly-detail-row" data-date="${date}" style="display: none;">
                  <td colspan="8">
                    <div class="hourly-detail-container" id="hourly-detail-${date}">
                      <div class="loading-indicator">載入中...</div>
                    </div>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
        : '';

    return monthSummary + dailyBreakdown;
  }

  private renderAllTimeData(): string {
    if (!this.allTimeData) {
      return `<div class="no-data"><p>${I18n.t.popup.noDataMessage}</p></div>`;
    }

    const allTimeSummary = this.renderUsageData(this.allTimeData);

    const dailyBreakdown =
      this.dailyDataForAllTime.length > 0
        ? `
      <div class="daily-breakdown">
        <h3>${I18n.t.popup.monthlyBreakdown}</h3>

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
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${this.dailyDataForAllTime
                .map(
                  ({ date, data }) => `
                <tr class="daily-row" data-date="${date}">
                  <td class="date-cell">${this.formatDate(date)}</td>
                  <td class="cost-cell">${I18n.formatCurrency(data.totalCost)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalInputTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalOutputTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalCacheCreationTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.totalCacheReadTokens)}</td>
                  <td class="number-cell">${I18n.formatNumber(data.messageCount)}</td>
                  <td class="detail-cell">
                    <button class="detail-button" onclick="toggleMonthlyDetail('${date}')" title="顯示每日詳細資料">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path class="expand-icon" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                      </svg>
                    </button>
                  </td>
                </tr>
                <tr class="monthly-detail-row" data-date="${date}" style="display: none;">
                  <td colspan="8">
                    <div class="monthly-detail-container" id="monthly-detail-${date}">
                      <div class="loading-indicator">載入中...</div>
                    </div>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
        : '';

    return allTimeSummary + dailyBreakdown;
  }

  private renderDailyChart(): string {
    if (this.dailyDataForMonth.length === 0) {
      return '<div class="no-chart-data">No data available</div>';
    }

    // Sort data by date (oldest first for chart display)
    const sortedData = [...this.dailyDataForMonth].sort((a, b) => a.date.localeCompare(b.date));

    // Generate chart bars for cost (default metric)
    const maxCost = Math.max(...sortedData.map((d) => d.data.totalCost));
    const maxHeight = 120; // Max height in pixels

    return `
      <div class="chart-bars">
        ${sortedData
          .map(({ date, data }) => {
            const height = maxCost > 0 ? (data.totalCost / maxCost) * maxHeight : 0;
            return `
            <div class="chart-bar-container" data-date="${date}">
              <div class="chart-bar cost-bar clickable"
                   style="height: ${height}px;"
                   data-cost="${data.totalCost}"
                   data-input="${data.totalInputTokens}"
                   data-output="${data.totalOutputTokens}"
                   data-cache-creation="${data.totalCacheCreationTokens}"
                   data-cache-read="${data.totalCacheReadTokens}"
                   data-messages="${data.messageCount}"
                   title="${this.formatDate(date)}: ${I18n.formatCurrency(data.totalCost)} - 點擊查看每小時詳情">
              </div>
              <div class="chart-label">${this.getShortDate(date)}</div>
            </div>
          `;
          })
          .join('')}
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
    const maxCost = Math.max(...sortedData.map((d) => d.data.totalCost));
    const maxHeight = 120; // Max height in pixels

    return `
      <div class="chart-bars">
        ${sortedData
          .map(({ date, data }) => {
            const height = maxCost > 0 ? (data.totalCost / maxCost) * maxHeight : 0;
            return `
            <div class="chart-bar-container" data-date="${date}">
              <div class="chart-bar cost-bar clickable"
                   style="height: ${height}px;"
                   data-cost="${data.totalCost}"
                   data-input="${data.totalInputTokens}"
                   data-output="${data.totalOutputTokens}"
                   data-cache-creation="${data.totalCacheCreationTokens}"
                   data-cache-read="${data.totalCacheReadTokens}"
                   data-messages="${data.messageCount}"
                   title="${this.formatDate(date)}: ${I18n.formatCurrency(data.totalCost)} - 點擊查看每日詳情">
              </div>
              <div class="chart-label">${this.getShortDate(date)}</div>
            </div>
          `;
          })
          .join('')}
      </div>
    `;
  }

  private renderHourlyChart(): string {
    if (this.hourlyDataForToday.length === 0) {
      return '<div class="no-chart-data">No data available</div>';
    }

    // Sort data by hour (chronological order)
    const sortedData = [...this.hourlyDataForToday].sort((a, b) => a.hour.localeCompare(b.hour));

    // Generate chart bars for cost (default metric)
    const maxCost = Math.max(...sortedData.map((d) => d.data.totalCost));
    const maxHeight = 120; // Max height in pixels

    return `
      <div class="chart-bars">
        ${sortedData
          .map(({ hour, data }) => {
            const height = maxCost > 0 ? (data.totalCost / maxCost) * maxHeight : 0;
            return `
            <div class="chart-bar-container" data-hour="${hour}">
              <div class="chart-bar cost-bar"
                   style="height: ${height}px;"
                   data-cost="${data.totalCost}"
                   data-input="${data.totalInputTokens}"
                   data-output="${data.totalOutputTokens}"
                   data-cache-creation="${data.totalCacheCreationTokens}"
                   data-cache-read="${data.totalCacheReadTokens}"
                   data-messages="${data.messageCount}"
                   title="${hour}: ${I18n.formatCurrency(data.totalCost)}">
              </div>
              <div class="chart-label">${hour}</div>
            </div>
          `;
          })
          .join('')}
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
        max-width: 800px;
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
        margin-bottom: 8px;
      }

      .chart-bar.clickable {
        cursor: pointer;
      }

      .chart-bar.clickable:hover {
        opacity: 0.8;
        transform: scaleY(1.05);
      }

      .chart-bar.selected {
        border: 2px solid var(--vscode-focusBorder);
        box-shadow: 0 0 4px var(--vscode-focusBorder);
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

      .detail-cell {
        text-align: center;
        width: 40px;
      }

      .detail-button {
        background: transparent;
        border: none;
        color: var(--vscode-foreground);
        cursor: pointer;
        padding: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
      }

      .detail-button:hover {
        background: var(--vscode-list-hoverBackground);
        border-radius: 4px;
      }

      .detail-button.expanded svg {
        transform: rotate(180deg);
      }

      .hourly-detail-row td {
        padding: 0;
        border-bottom: 1px solid var(--vscode-panel-border);
      }

      .hourly-detail-container {
        padding: 16px;
        background: var(--vscode-input-background);
        border-top: 1px solid var(--vscode-panel-border);
      }

      .hourly-detail-container h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: var(--vscode-foreground);
      }

      .loading-indicator {
        text-align: center;
        color: var(--vscode-descriptionForeground);
        padding: 20px;
      }
    `;
  }

  private getScript(): string {
    return `
console.log("[DEBUG] === JAVASCRIPT INITIALIZATION START ===");

// Get VSCode API
const vscode = acquireVsCodeApi();
console.log("[DEBUG] VSCode API acquired");

// Define basic functions
function refresh() {
  console.log("[DEBUG] refresh called");
  vscode.postMessage({ command: 'refresh' });
}

function openSettings() {
  console.log("[DEBUG] openSettings called");
  vscode.postMessage({ command: 'openSettings' });
}

function showTab(tabName) {
  console.log("[DEBUG] showTab called:", tabName);

  try {
    // Remove active from all tabs and contents
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Add active to selected tab and content
    const selectedTab = document.getElementById('tab-' + tabName);
    const selectedContent = document.getElementById(tabName);

    if (selectedTab && selectedContent) {
      selectedTab.classList.add('active');
      selectedContent.classList.add('active');
      console.log("[DEBUG] Tab switched successfully to:", tabName);

      // Notify extension
      vscode.postMessage({ command: 'tabChanged', tab: tabName });
    } else {
      console.error("[DEBUG] Tab or content not found:", tabName);
    }
  } catch (error) {
    console.error("[DEBUG] Error switching tabs:", error);
  }
}

function toggleHourlyDetail(date) {
  console.log("[DEBUG] toggleHourlyDetail called for date:", date);

  try {
    const detailRow = document.querySelector('.hourly-detail-row[data-date="' + date + '"]');
    const button = document.querySelector('.daily-row[data-date="' + date + '"] .detail-button');
    const container = document.getElementById('hourly-detail-' + date);
    const chartBar = document.querySelector('.chart-bar-container[data-date="' + date + '"] .chart-bar');

    console.log("[DEBUG] Found elements:", {
      detailRow: !!detailRow,
      button: !!button,
      container: !!container,
      chartBar: !!chartBar
    });

    if (detailRow && button && container) {
      const isExpanded = detailRow.style.display !== 'none' && detailRow.style.display !== '';

      if (!isExpanded) {
        // First, close all other expanded details
        closeAllHourlyDetails();

        // Show detail for this date
        detailRow.style.display = 'table-row';
        button.classList.add('expanded');

        // Update chart bar selection state
        if (chartBar) {
          chartBar.classList.add('selected');
          console.log("[DEBUG] Chart bar selected for date:", date);
        }

        console.log("[DEBUG] Showing hourly detail for date:", date);

        // Request hourly data if not loaded
        if (!container.dataset.loaded) {
          console.log("[DEBUG] Requesting hourly data for date:", date);
          vscode.postMessage({ command: 'getHourlyData', date: date });
          container.dataset.loaded = 'true';
        }
      } else {
        // Hide detail
        detailRow.style.display = 'none';
        button.classList.remove('expanded');

        // Update chart bar selection state
        if (chartBar) {
          chartBar.classList.remove('selected');
          console.log("[DEBUG] Chart bar deselected for date:", date);
        }

        console.log("[DEBUG] Hiding hourly detail for date:", date);
      }

    } else {
      console.error("[DEBUG] Could not find required elements for date:", date);
    }
  } catch (error) {
    console.error("[DEBUG] Error in toggleHourlyDetail:", error);
  }
}

function closeAllHourlyDetails() {
  console.log("[DEBUG] closeAllHourlyDetails called");

  // Close all expanded detail rows
  const allDetailRows = document.querySelectorAll('.hourly-detail-row');
  const allButtons = document.querySelectorAll('.detail-button.expanded');
  const allChartBars = document.querySelectorAll('.chart-bar.selected');

  allDetailRows.forEach(function(row) {
    row.style.display = 'none';
  });

  allButtons.forEach(function(btn) {
    btn.classList.remove('expanded');
  });

  allChartBars.forEach(function(bar) {
    bar.classList.remove('selected');
  });

  console.log("[DEBUG] Closed all detail rows");
}

function toggleMonthlyDetail(monthDate) {
  console.log("[DEBUG] toggleMonthlyDetail called for month:", monthDate);

  try {
    const detailRow = document.querySelector('.monthly-detail-row[data-date="' + monthDate + '"]');
    const button = document.querySelector('.daily-row[data-date="' + monthDate + '"] .detail-button');
    const container = document.getElementById('monthly-detail-' + monthDate);
    const chartBar = document.querySelector('.chart-bar-container[data-date="' + monthDate + '"] .chart-bar');

    console.log("[DEBUG] Found elements:", {
      detailRow: !!detailRow,
      button: !!button,
      container: !!container,
      chartBar: !!chartBar
    });

    if (detailRow && button && container) {
      const isExpanded = detailRow.style.display !== 'none' && detailRow.style.display !== '';

      if (!isExpanded) {
        // First, close all other expanded details
        closeAllMonthlyDetails();

        // Show detail for this month
        detailRow.style.display = 'table-row';
        button.classList.add('expanded');

        // Update chart bar selection state
        if (chartBar) {
          chartBar.classList.add('selected');
          console.log("[DEBUG] Chart bar selected for month:", monthDate);
        }

        console.log("[DEBUG] Showing monthly detail for month:", monthDate);

        // Request monthly data if not loaded
        if (!container.dataset.loaded) {
          console.log("[DEBUG] Requesting daily data for month:", monthDate);
          vscode.postMessage({ command: 'getDailyData', month: monthDate });
          container.dataset.loaded = 'true';
        }
      } else {
        // Hide detail
        detailRow.style.display = 'none';
        button.classList.remove('expanded');

        // Update chart bar selection state
        if (chartBar) {
          chartBar.classList.remove('selected');
          console.log("[DEBUG] Chart bar deselected for month:", monthDate);
        }

        console.log("[DEBUG] Hiding monthly detail for month:", monthDate);
      }

    } else {
      console.error("[DEBUG] Could not find required elements for month:", monthDate);
    }
  } catch (error) {
    console.error("[DEBUG] Error in toggleMonthlyDetail:", error);
  }
}

function closeAllMonthlyDetails() {
  console.log("[DEBUG] closeAllMonthlyDetails called");

  // Close all expanded monthly detail rows
  const allDetailRows = document.querySelectorAll('.monthly-detail-row');
  const allButtons = document.querySelectorAll('.detail-button.expanded');
  const allChartBars = document.querySelectorAll('.chart-bar.selected');

  allDetailRows.forEach(function(row) {
    row.style.display = 'none';
  });

  allButtons.forEach(function(btn) {
    btn.classList.remove('expanded');
  });

  allChartBars.forEach(function(bar) {
    bar.classList.remove('selected');
  });

  console.log("[DEBUG] Closed all monthly detail rows");
}

function updateHourlyChart(date, metric) {
  console.log("[DEBUG] updateHourlyChart called with date:", date, "metric:", metric);

  const container = document.getElementById('hourly-detail-' + date);
  if (!container) return;

  // Update active tab
  const tabs = container.querySelectorAll('.chart-tab');
  tabs.forEach(function(tab) {
    if (tab.dataset.metric === metric) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Re-render chart
  const chartContainer = document.getElementById('hourly-chart-' + date);
  const hourlyData = window['hourlyData_' + date];
  if (hourlyData && chartContainer) {
    chartContainer.innerHTML = renderHourlyChart(hourlyData, metric);
  }
}

// Sync chart bar selection state
function syncChartBarSelection(date, isSelected) {
  console.log("[DEBUG] syncChartBarSelection called for date:", date, "selected:", isSelected);

  const chartBar = document.querySelector('.chart-bar-container[data-date="' + date + '"] .chart-bar');
  if (chartBar) {
    if (isSelected) {
      chartBar.classList.add('selected');
    } else {
      chartBar.classList.remove('selected');
    }
  }
}

// Make functions available globally
window.refresh = refresh;
window.openSettings = openSettings;
window.showTab = showTab;
window.toggleHourlyDetail = toggleHourlyDetail;
window.toggleMonthlyDetail = toggleMonthlyDetail;
window.updateHourlyChart = updateHourlyChart;
window.syncChartBarSelection = syncChartBarSelection;
window.closeAllHourlyDetails = closeAllHourlyDetails;
window.closeAllMonthlyDetails = closeAllMonthlyDetails;

// Handle messages from extension
window.addEventListener('message', function(event) {
  const message = event.data;
  console.log("[DEBUG] Received message from extension:", message);

  if (message.command === 'hourlyDataResponse') {
    const container = document.getElementById('hourly-detail-' + message.date);
    if (container && message.data) {
      console.log("[DEBUG] Rendering hourly data for date:", message.date);
      container.innerHTML = renderHourlyData(message.data, message.date);

      // Re-bind chart tab events after rendering
      bindChartTabEvents(container);
    }
  }

  if (message.command === 'dailyDataResponse') {
    const container = document.getElementById('monthly-detail-' + message.month);
    if (container && message.data) {
      console.log("[DEBUG] Rendering daily data for month:", message.month);
      container.innerHTML = renderDailyData(message.data, message.month);

      // Re-bind chart tab events after rendering
      bindChartTabEvents(container);
    }
  }
});

// Global event delegation for chart tabs and chart bars
document.addEventListener('click', function(event) {
  console.log("[DEBUG] Document click event:", event.target);

  // Handle chart tab clicks
  if (event.target.classList.contains('chart-tab')) {
    console.log("[DEBUG] Chart tab clicked:", event.target);

    event.preventDefault();
    const metric = event.target.dataset.metric;
    console.log("[DEBUG] Chart tab metric:", metric);

    // Find the container and determine the context
    const container = event.target.closest('.daily-breakdown') || event.target.closest('.hourly-breakdown');
    console.log("[DEBUG] Chart tab container:", container);

    if (container) {
      // Update active tab
      const tabs = container.querySelectorAll('.chart-tab');
      tabs.forEach(function(tab) {
        tab.classList.remove('active');
      });
      event.target.classList.add('active');

      // Determine chart type and update accordingly
      if (container.classList.contains('hourly-breakdown')) {
        // This is an hourly detail chart - extract date from the chart content ID
        const chartContent = container.querySelector('[id^="hourly-chart-"]');
        if (chartContent) {
          const date = chartContent.id.replace('hourly-chart-', '');
          console.log("[DEBUG] Updating hourly chart for date:", date, "metric:", metric);
          updateHourlyChart(date, metric);
        }
      } else {
        // This is a main chart (daily/monthly)
        console.log("[DEBUG] Updating main chart with metric:", metric);
        updateMainChart(metric, container);
      }
    }
  }

  // Handle chart bar clicks - only for clickable charts
  if (event.target.classList.contains('chart-bar') && event.target.classList.contains('clickable')) {
    console.log("[DEBUG] Clickable chart bar clicked:", event.target);

    event.preventDefault();
    const container = event.target.closest('.chart-bar-container');
    if (container) {
      const date = container.dataset.date;
      if (date) {
        console.log("[DEBUG] Chart bar clicked for date:", date);

        // Determine if this is a monthly chart or daily chart based on current tab
        const activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.id === 'tab-all') {
          // This is in the "all time" tab, so it's a monthly chart
          toggleMonthlyDetail(date);
        } else {
          // This is in the "month" tab, so it's a daily chart
          toggleHourlyDetail(date);
        }
      }
    }
  }
});

function bindChartTabEvents(container) {
  console.log("[DEBUG] Binding chart tab events for container:", container);

  const chartTabs = container.querySelectorAll('.chart-tab');
  console.log("[DEBUG] Found chart tabs:", chartTabs.length);

  chartTabs.forEach(function(tab, index) {
    console.log("[DEBUG] Processing chart tab", index, ":", tab.dataset.metric);

    // Remove existing event listeners to prevent duplicates
    tab.removeEventListener('click', handleChartTabClick);

    // Add new event listener
    tab.addEventListener('click', handleChartTabClick);
  });
}

function handleChartTabClick(event) {
  console.log("[DEBUG] handleChartTabClick called");
  event.preventDefault();

  const metric = this.dataset.metric;
  const container = this.closest('.daily-breakdown') || this.closest('.hourly-breakdown');

  if (container) {
    // Update active tab
    const tabs = container.querySelectorAll('.chart-tab');
    tabs.forEach(function(tab) {
      tab.classList.remove('active');
    });
    this.classList.add('active');

    // Update chart based on context
    if (container.classList.contains('hourly-breakdown')) {
      const chartContent = container.querySelector('[id^="hourly-chart-"]');
      if (chartContent) {
        const date = chartContent.id.replace('hourly-chart-', '');
        updateHourlyChart(date, metric);
      }
    } else {
      updateMainChart(metric, null);
    }
  }
}

function updateMainChart(metric, container) {
  console.log("[DEBUG] updateMainChart called with metric:", metric, "container:", container);

  // If container is provided, use it; otherwise find the active tab content
  let targetContainer = container;
  if (!targetContainer) {
    targetContainer = document.querySelector('.tab-content.active');
    if (!targetContainer) {
      console.error("[DEBUG] No active tab content found");
      return;
    }
  }

  // Update chart in the target container
  const chartBars = targetContainer.querySelectorAll('.chart-bar');
  if (chartBars.length === 0) {
    console.log("[DEBUG] No chart bars found in target container");
    return;
  }

  console.log("[DEBUG] Updating", chartBars.length, "chart bars with metric:", metric);

  // Calculate max values for the metric
  const values = Array.from(chartBars).map(function(bar) {
    const value = parseFloat(bar.dataset[getDataAttribute(metric)]) || 0;
    return value;
  });

  const maxValue = Math.max(...values);
  const maxHeight = 120;

  console.log("[DEBUG] Max value for metric", metric, ":", maxValue);

  // Update each bar
  chartBars.forEach(function(bar, index) {
    const value = parseFloat(bar.dataset[getDataAttribute(metric)]) || 0;
    const height = maxValue > 0 ? (value / maxValue) * maxHeight : 2;

    // Update height
    bar.style.height = height + 'px';

    // Update class - preserve clickable and selected states
    const baseClass = 'chart-bar ' + getBarClass(metric);
    const hasClickable = bar.classList.contains('clickable');
    const hasSelected = bar.classList.contains('selected');

    bar.className = baseClass;
    if (hasClickable) {
      bar.classList.add('clickable');
    }
    if (hasSelected) {
      bar.classList.add('selected');
    }

    // Update tooltip
    const formattedValue = formatValue(value, metric);
    const container = bar.parentElement;
    const date = container.dataset.date;
    const hour = container.dataset.hour;

    if (hour) {
      bar.title = hour + ': ' + formattedValue;
    } else if (date) {
      const dateObj = new Date(date);
      bar.title = dateObj.toLocaleDateString() + ': ' + formattedValue;
    }
  });
}

function getDataAttribute(metric) {
  const mapping = {
    'cost': 'cost',
    'inputTokens': 'input',
    'outputTokens': 'output',
    'cacheCreation': 'cacheCreation',
    'cacheRead': 'cacheRead',
    'messages': 'messages'
  };
  return mapping[metric] || 'cost';
}

function getBarClass(metric) {
  const mapping = {
    'cost': 'cost-bar',
    'inputTokens': 'input-bar',
    'outputTokens': 'output-bar',
    'cacheCreation': 'cache-creation-bar',
    'cacheRead': 'cache-read-bar',
    'messages': 'messages-bar'
  };
  return mapping[metric] || 'cost-bar';
}

function formatValue(value, metric) {
  if (metric === 'cost') {
    return '$' + value.toFixed(2);
  } else {
    return value.toLocaleString();
  }
}

function renderHourlyData(hourlyData, date) {
  console.log("[DEBUG] renderHourlyData called with data:", hourlyData);

  if (!hourlyData || hourlyData.length === 0) {
    return '<div class="no-data">當日無使用資料</div>';
  }

  let html = '<div class="hourly-breakdown">';
  html += '<h4>' + new Date(date).toLocaleDateString() + ' ' + I18n.t.popup.hourlyBreakdown + '</h4>';

  // Chart tabs
  html += '<div class="chart-tabs">';
  html += '<button class="chart-tab active" data-metric="cost">費用</button>';
  html += '<button class="chart-tab" data-metric="inputTokens">輸入 Token</button>';
  html += '<button class="chart-tab" data-metric="outputTokens">輸出 Token</button>';
  html += '<button class="chart-tab" data-metric="cacheCreation">快取建立</button>';
  html += '<button class="chart-tab" data-metric="cacheRead">快取讀取</button>';
  html += '<button class="chart-tab" data-metric="messages">訊息數</button>';
  html += '</div>';

  // Chart container
  html += '<div class="chart-container">';
  html += '<div class="chart-content" id="hourly-chart-' + date + '">';
  html += renderHourlyChart(hourlyData, 'cost');
  html += '</div>';
  html += '</div>';

  // Table
  html += '<div class="daily-table-container">';
  html += '<table class="daily-table">';
  html += '<thead>';
  html += '<tr>';
  html += '<th>時間</th>';
  html += '<th>費用</th>';
  html += '<th>輸入 Token</th>';
  html += '<th>輸出 Token</th>';
  html += '<th>快取建立</th>';
  html += '<th>快取讀取</th>';
  html += '<th>訊息數</th>';
  html += '</tr>';
  html += '</thead>';
  html += '<tbody>';

  hourlyData.forEach(function(item) {
    html += '<tr>';
    html += '<td class="date-cell">' + item.hour + '</td>';
    html += '<td class="cost-cell">$' + item.data.totalCost.toFixed(2) + '</td>';
    html += '<td class="number-cell">' + item.data.totalInputTokens.toLocaleString() + '</td>';
    html += '<td class="number-cell">' + item.data.totalOutputTokens.toLocaleString() + '</td>';
    html += '<td class="number-cell">' + item.data.totalCacheCreationTokens.toLocaleString() + '</td>';
    html += '<td class="number-cell">' + item.data.totalCacheReadTokens.toLocaleString() + '</td>';
    html += '<td class="number-cell">' + item.data.messageCount.toLocaleString() + '</td>';
    html += '</tr>';
  });

  html += '</tbody>';
  html += '</table>';
  html += '</div>';

  // Store data for chart updates
  window['hourlyData_' + date] = hourlyData;

  html += '</div>'; // Close hourly-breakdown

  return html;
}

function renderDailyData(dailyData, monthDate) {
  console.log("[DEBUG] renderDailyData called with data:", dailyData);

  if (!dailyData || dailyData.length === 0) {
    return '<div class="no-data">該月無使用資料</div>';
  }

  let html = '<div class="daily-breakdown">';
  html += '<h4>' + new Date(monthDate).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' }) + ' 每日使用量</h4>';

  // Chart tabs
  html += '<div class="chart-tabs">';
  html += '<button class="chart-tab active" data-metric="cost">費用</button>';
  html += '<button class="chart-tab" data-metric="inputTokens">輸入 Token</button>';
  html += '<button class="chart-tab" data-metric="outputTokens">輸出 Token</button>';
  html += '<button class="chart-tab" data-metric="cacheCreation">快取建立</button>';
  html += '<button class="chart-tab" data-metric="cacheRead">快取讀取</button>';
  html += '<button class="chart-tab" data-metric="messages">訊息數</button>';
  html += '</div>';

  // Chart container
  html += '<div class="chart-container">';
  html += '<div class="chart-content" id="daily-chart-' + monthDate + '">';
  html += renderDailyChart(dailyData, 'cost');
  html += '</div>';
  html += '</div>';

  // Table
  html += '<div class="daily-table-container">';
  html += '<table class="daily-table">';
  html += '<thead>';
  html += '<tr>';
  html += '<th>日期</th>';
  html += '<th>費用</th>';
  html += '<th>輸入 Token</th>';
  html += '<th>輸出 Token</th>';
  html += '<th>快取建立</th>';
  html += '<th>快取讀取</th>';
  html += '<th>訊息數</th>';
  html += '</tr>';
  html += '</thead>';
  html += '<tbody>';

  dailyData.forEach(function(item) {
    const dateObj = new Date(item.date);
    const formattedDate = dateObj.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });

    html += '<tr>';
    html += '<td class="date-cell">' + formattedDate + '</td>';
    html += '<td class="cost-cell">$' + item.data.totalCost.toFixed(2) + '</td>';
    html += '<td class="number-cell">' + item.data.totalInputTokens.toLocaleString() + '</td>';
    html += '<td class="number-cell">' + item.data.totalOutputTokens.toLocaleString() + '</td>';
    html += '<td class="number-cell">' + item.data.totalCacheCreationTokens.toLocaleString() + '</td>';
    html += '<td class="number-cell">' + item.data.totalCacheReadTokens.toLocaleString() + '</td>';
    html += '<td class="number-cell">' + item.data.messageCount.toLocaleString() + '</td>';
    html += '</tr>';
  });

  html += '</tbody>';
  html += '</table>';
  html += '</div>';

  // Store data for chart updates
  window['dailyData_' + monthDate] = dailyData;

  html += '</div>'; // Close daily-breakdown

  return html;
}

function renderDailyChart(dailyData, metric) {
  console.log("[DEBUG] renderDailyChart called with metric:", metric);

  const maxValues = {
    cost: Math.max(...dailyData.map(d => d.data.totalCost)),
    inputTokens: Math.max(...dailyData.map(d => d.data.totalInputTokens)),
    outputTokens: Math.max(...dailyData.map(d => d.data.totalOutputTokens)),
    cacheCreation: Math.max(...dailyData.map(d => d.data.totalCacheCreationTokens)),
    cacheRead: Math.max(...dailyData.map(d => d.data.totalCacheReadTokens)),
    messages: Math.max(...dailyData.map(d => d.data.messageCount))
  };

  const maxHeight = 120;
  const maxValue = maxValues[metric] || 0;

  let html = '<div class="chart-bars">';

  dailyData.forEach(function(item) {
    let value = 0;
    let barClass = 'cost-bar';

    switch(metric) {
      case 'cost':
        value = item.data.totalCost;
        barClass = 'cost-bar';
        break;
      case 'inputTokens':
        value = item.data.totalInputTokens;
        barClass = 'input-bar';
        break;
      case 'outputTokens':
        value = item.data.totalOutputTokens;
        barClass = 'output-bar';
        break;
      case 'cacheCreation':
        value = item.data.totalCacheCreationTokens;
        barClass = 'cache-creation-bar';
        break;
      case 'cacheRead':
        value = item.data.totalCacheReadTokens;
        barClass = 'cache-read-bar';
        break;
      case 'messages':
        value = item.data.messageCount;
        barClass = 'messages-bar';
        break;
    }

    const height = maxValue > 0 ? Math.max((value / maxValue) * maxHeight, 2) : 2;
    const dateObj = new Date(item.date);
    const shortDate = dateObj.getDate().toString();

    html += '<div class="chart-bar-container" data-date="' + item.date + '">';
    html += '<div class="chart-bar ' + barClass + '" ';
    html += 'style="height: ' + height + 'px;" ';
    html += 'data-cost="' + item.data.totalCost + '" ';
    html += 'data-input="' + item.data.totalInputTokens + '" ';
    html += 'data-output="' + item.data.totalOutputTokens + '" ';
    html += 'data-cache-creation="' + item.data.totalCacheCreationTokens + '" ';
    html += 'data-cache-read="' + item.data.totalCacheReadTokens + '" ';
    html += 'data-messages="' + item.data.messageCount + '" ';
    html += 'title="' + dateObj.toLocaleDateString('zh-TW') + ': ' + formatValue(value, metric) + '">';
    html += '</div>';
    html += '<div class="chart-label">' + shortDate + '</div>';
    html += '</div>';
  });

  html += '</div>';

  return html;
}

function renderHourlyChart(hourlyData, metric) {
  console.log("[DEBUG] renderHourlyChart called with metric:", metric);

  const maxValues = {
    cost: Math.max(...hourlyData.map(d => d.data.totalCost)),
    inputTokens: Math.max(...hourlyData.map(d => d.data.totalInputTokens)),
    outputTokens: Math.max(...hourlyData.map(d => d.data.totalOutputTokens)),
    cacheCreation: Math.max(...hourlyData.map(d => d.data.totalCacheCreationTokens)),
    cacheRead: Math.max(...hourlyData.map(d => d.data.totalCacheReadTokens)),
    messages: Math.max(...hourlyData.map(d => d.data.messageCount))
  };

  const maxHeight = 120;
  const maxValue = maxValues[metric] || 0;

  let html = '<div class="chart-bars">';

  hourlyData.forEach(function(item) {
    let value = 0;
    let barClass = 'cost-bar';

    switch(metric) {
      case 'cost':
        value = item.data.totalCost;
        barClass = 'cost-bar';
        break;
      case 'inputTokens':
        value = item.data.totalInputTokens;
        barClass = 'input-bar';
        break;
      case 'outputTokens':
        value = item.data.totalOutputTokens;
        barClass = 'output-bar';
        break;
      case 'cacheCreation':
        value = item.data.totalCacheCreationTokens;
        barClass = 'cache-creation-bar';
        break;
      case 'cacheRead':
        value = item.data.totalCacheReadTokens;
        barClass = 'cache-read-bar';
        break;
      case 'messages':
        value = item.data.messageCount;
        barClass = 'messages-bar';
        break;
    }

    const height = maxValue > 0 ? Math.max((value / maxValue) * maxHeight, 2) : 2;

    html += '<div class="chart-bar-container" data-hour="' + item.hour + '">';
    html += '<div class="chart-bar ' + barClass + '" ';
    html += 'style="height: ' + height + 'px;" ';
    html += 'data-cost="' + item.data.totalCost + '" ';
    html += 'data-input="' + item.data.totalInputTokens + '" ';
    html += 'data-output="' + item.data.totalOutputTokens + '" ';
    html += 'data-cache-creation="' + item.data.totalCacheCreationTokens + '" ';
    html += 'data-cache-read="' + item.data.totalCacheReadTokens + '" ';
    html += 'data-messages="' + item.data.messageCount + '" ';
    html += 'title="' + item.hour + ': ' + formatValue(value, metric) + '">';
    html += '</div>';
    html += '<div class="chart-label">' + item.hour + '</div>';
    html += '</div>';
  });

  html += '</div>';

  return html;
}

// Initialize chart tab events for existing elements
setTimeout(function() {
  console.log("[DEBUG] Initializing chart tab events for existing elements");
  const existingChartContainers = document.querySelectorAll('.daily-breakdown');
  existingChartContainers.forEach(function(container) {
    bindChartTabEvents(container);
  });
}, 1000);

console.log("[DEBUG] All functions defined and ready");`;
  }

  dispose(): void {
    if (this.panel) {
      this.panel.dispose();
    }
  }
}
