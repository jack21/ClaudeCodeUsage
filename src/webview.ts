import * as vscode from 'vscode';
import { I18n } from './i18n';
import { getModelRatesPerMillion } from './pricing';
import { BranchUsage, ContentAnalysis, ProjectGroup, ProjectUsage, SessionData, SessionUsage, UsageData } from './types';

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
  private sessionBreakdown: SessionUsage[] = [];
  private projectBreakdown: ProjectGroup[] = [];
  private contentAnalysis: ContentAnalysis | null = null;
  private branchBreakdown: BranchUsage[] = [];

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
        case 'refreshPricing':
          vscode.commands.executeCommand('claudeCodeUsage.refreshPricing');
          break;
        case 'getAdvice':
          vscode.commands.executeCommand('claudeCodeUsage.getAdvice');
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
    allRecords?: any[],
    sessionBreakdown: SessionUsage[] = [],
    projectBreakdown: ProjectGroup[] = [],
    contentAnalysis: ContentAnalysis | null = null,
    branchBreakdown: BranchUsage[] = []
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
    this.sessionBreakdown = sessionBreakdown;
    this.projectBreakdown = projectBreakdown;
    this.contentAnalysis = contentAnalysis;
    this.branchBreakdown = branchBreakdown;

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
    const sessions = I18n.t.popup.sessions;
    const projects = I18n.t.popup.projects;
    const contentTab = I18n.t.popup.contentAnalysis;
    const branchesTab = I18n.t.popup.branches;

    const todayActive = this.currentTab === 'today' ? 'active' : '';
    const monthActive = this.currentTab === 'month' ? 'active' : '';
    const allActive = this.currentTab === 'all' ? 'active' : '';
    const sessionsActive = this.currentTab === 'sessions' ? 'active' : '';
    const projectsActive = this.currentTab === 'projects' ? 'active' : '';
    const contentActive = this.currentTab === 'content' ? 'active' : '';
    const branchesActive = this.currentTab === 'branches' ? 'active' : '';

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
            <button id="tab-sessions" class="tab ` +
      sessionsActive +
      `" onclick="showTab('sessions')">` +
      sessions +
      `</button>
            <button id="tab-projects" class="tab ` +
      projectsActive +
      `" onclick="showTab('projects')">` +
      projects +
      `</button>
            <button id="tab-content" class="tab ` +
      contentActive +
      `" onclick="showTab('content')">` +
      contentTab +
      `</button>
            <button id="tab-branches" class="tab ` +
      branchesActive +
      `" onclick="showTab('branches')">` +
      branchesTab +
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

          <div id="sessions" class="tab-content ` +
      sessionsActive +
      `">
            ` +
      this.renderSessionData() +
      `
          </div>

          <div id="projects" class="tab-content ` +
      projectsActive +
      `">
            ` +
      this.renderProjectData() +
      `
          </div>

          <div id="content" class="tab-content ` +
      contentActive +
      `">
            ` +
      this.renderContentData() +
      `
          </div>

          <div id="branches" class="tab-content ` +
      branchesActive +
      `">
            ` +
      this.renderBranchData() +
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
        this.renderHourlyChart() +
        this.renderCompositionChart(
          [...this.hourlyDataForToday]
            .sort((a, b) => a.hour.localeCompare(b.hour))
            .map((h) => ({ label: h.hour, data: h.data }))
        ) +
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
    const pricing = I18n.t.popup.pricing;
    const refreshPricing = I18n.t.popup.refreshPricing;

    // Cache hit rate: share of input-side tokens served cheaply from cache.
    const inputSideTokens = data.totalInputTokens + data.totalCacheCreationTokens + data.totalCacheReadTokens;
    const cacheHitRate = inputSideTokens > 0 ? (data.totalCacheReadTokens / inputSideTokens) * 100 : 0;

    // Cost composition: how each token type contributes to the total cost.
    const cb = data.costBreakdown;
    const costTotal = cb.input + cb.output + cb.cacheWrite + cb.cacheRead;
    const cpct = (v: number): number => (costTotal > 0 ? (v / costTotal) * 100 : 0);
    const compSeg = (cls: string, v: number): string =>
      '<div class="cost-comp-seg ' + cls + '" style="width: ' + cpct(v).toFixed(2) + '%;"></div>';
    const compItem = (cls: string, label: string, v: number): string =>
      '<span class="legend-item"><span class="legend-dot ' + cls + '"></span>' +
      label + ' ' + I18n.formatCurrency(v) + ' (' + cpct(v).toFixed(0) + '%)</span>';
    const costComposition =
      costTotal > 0
        ? '<div class="cost-composition">' +
          '<div class="cost-comp-head">' + I18n.t.popup.costComposition + '</div>' +
          '<div class="cost-comp-bar">' +
          compSeg('seg-input', cb.input) +
          compSeg('seg-output', cb.output) +
          compSeg('seg-cache-creation', cb.cacheWrite) +
          compSeg('seg-cache-read', cb.cacheRead) +
          '</div>' +
          '<div class="cost-comp-legend">' +
          compItem('seg-input', inputTokens, cb.input) +
          compItem('seg-output', outputTokens, cb.output) +
          compItem('seg-cache-creation', cacheCreation, cb.cacheWrite) +
          compItem('seg-cache-read', cacheRead, cb.cacheRead) +
          '</div>' +
          '</div>'
        : '';

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
      '<div class="summary-item">' +
      '<div class="label">' +
      I18n.t.popup.cacheHitRate +
      '</div>' +
      '<div class="value">' +
      cacheHitRate.toFixed(0) +
      '%</div>' +
      '</div>' +
      '</div>' +
      costComposition +
      '</div>';

    if (Object.keys(data.modelBreakdown).length > 0) {
      html +=
        '<div class="model-breakdown">' +
        '<div class="section-header">' +
        '<h3>' +
        modelBreakdown +
        '</h3>' +
        '<button class="btn-secondary btn-small" onclick="refreshPricing()" title="' +
        this.escapeHtml(refreshPricing) +
        '">↻ ' +
        refreshPricing +
        '</button>' +
        '</div>' +
        '<div class="model-list">';

      Object.entries(data.modelBreakdown).forEach(([model, modelData]) => {
        const rates = getModelRatesPerMillion(model);
        const pricingLine = rates
          ? '<div class="model-pricing">' +
            pricing +
            ' (/1M): ' +
            inputTokens +
            ' ' +
            this.formatRate(rates.input) +
            ' · ' +
            outputTokens +
            ' ' +
            this.formatRate(rates.output) +
            ' · ' +
            cacheCreation +
            ' ' +
            this.formatRate(rates.cacheWrite) +
            ' · ' +
            cacheRead +
            ' ' +
            this.formatRate(rates.cacheRead) +
            '</div>'
          : '';
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
          pricingLine +
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

        ${this.renderCompositionChart(
          [...this.dailyDataForMonth]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((d) => ({ label: this.getShortDate(d.date), data: d.data }))
        )}

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

        ${this.renderCompositionChart(
          [...this.dailyDataForAllTime]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((d) => ({ label: this.getShortDate(d.date), data: d.data }))
        )}

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

  private renderSessionData(): string {
    if (!this.sessionBreakdown || this.sessionBreakdown.length === 0) {
      return '<div class="no-data"><p>' + I18n.t.popup.noDataMessage + '</p></div>';
    }

    const t = I18n.t.popup;

    let rows = '';
    this.sessionBreakdown.forEach((s) => {
      const d = s.data;
      rows +=
        '<tr class="sort-row"' +
        ' data-sort-time="' + s.startTime.getTime() + '"' +
        ' data-sort-project="' + this.escapeHtml((s.projectName || '').toLowerCase()) + '"' +
        ' data-sort-context="' + s.peakContextTokens + '"' +
        ' data-sort-duration="' + (s.endTime.getTime() - s.startTime.getTime()) + '"' +
        this.usageSortAttrs(d) +
        '>' +
        '<td class="date-cell" title="' + this.escapeHtml(s.sessionId) + '">' +
        this.escapeHtml(this.formatDateTime(s.startTime)) +
        '</td>' +
        this.renderProjectCell(s.projectName, s.projectPath) +
        '<td class="cost-cell">' + I18n.formatCurrency(d.totalCost) + '</td>' +
        '<td class="number-cell">' + I18n.formatNumber(d.totalInputTokens) + '</td>' +
        '<td class="number-cell">' + I18n.formatNumber(d.totalOutputTokens) + '</td>' +
        '<td class="number-cell">' + I18n.formatNumber(d.totalCacheCreationTokens) + '</td>' +
        '<td class="number-cell">' + I18n.formatNumber(d.totalCacheReadTokens) + '</td>' +
        '<td class="number-cell">' + I18n.formatNumber(s.peakContextTokens) + '</td>' +
        '<td class="number-cell">' + I18n.formatNumber(d.messageCount) + '</td>' +
        '<td class="number-cell">' + this.escapeHtml(this.formatDuration(s.startTime, s.endTime)) + '</td>' +
        '</tr>';
    });

    const th = (key: string, label: string): string =>
      '<th class="sortable" data-sortkey="' + key + '">' + label + '</th>';

    return (
      '<div class="daily-breakdown">' +
      '<h3>' + t.sessionBreakdown + '</h3>' +
      '<p class="table-hint">' + t.sortHint + '</p>' +
      '<div class="daily-table-container">' +
      '<table class="daily-table sortable-table">' +
      '<thead><tr>' +
      th('time', t.startTime) +
      th('project', t.project) +
      th('cost', t.cost) +
      th('input', t.inputTokens) +
      th('output', t.outputTokens) +
      th('cachecreate', t.cacheCreation) +
      th('cacheread', t.cacheRead) +
      th('context', t.peakContext) +
      th('messages', t.messages) +
      th('duration', t.duration) +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>'
    );
  }

  /** Reading-friendly date/time: "Today HH:MM", "Yesterday HH:MM", "MM-DD HH:MM" or "YYYY-MM-DD". */
  private formatDateTime(date: Date): string {
    if (!date || isNaN(date.getTime()) || date.getTime() === 0) {
      return '-';
    }
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    const hm = pad(date.getHours()) + ':' + pad(date.getMinutes());
    const sameDay = (a: Date, b: Date): boolean =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (sameDay(date, now)) {
      return I18n.t.popup.today + ' ' + hm;
    }
    if (sameDay(date, yesterday)) {
      return I18n.t.popup.yesterday + ' ' + hm;
    }
    if (date.getFullYear() === now.getFullYear()) {
      return pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + hm;
    }
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  /** USD per-1M-token rate, trimmed of trailing zeros for compact display. */
  private formatRate(n: number): string {
    return '$' + parseFloat(n.toFixed(4)).toString();
  }

  /** data-sort-* attributes for the token/cost columns shared by both tables. */
  private usageSortAttrs(d: UsageData): string {
    return (
      ' data-sort-cost="' + d.totalCost +
      '" data-sort-input="' + d.totalInputTokens +
      '" data-sort-output="' + d.totalOutputTokens +
      '" data-sort-cachecreate="' + d.totalCacheCreationTokens +
      '" data-sort-cacheread="' + d.totalCacheReadTokens +
      '" data-sort-messages="' + d.messageCount + '"'
    );
  }

  private formatDuration(start: Date, end: Date): string {
    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
      return '-';
    }
    const ms = end.getTime() - start.getTime();
    if (ms <= 0) {
      return '<1m';
    }
    const totalMinutes = Math.round(ms / 60000);
    if (totalMinutes < 1) {
      return '<1m';
    }
    if (totalMinutes < 60) {
      return totalMinutes + 'm';
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? hours + 'h ' + minutes + 'm' : hours + 'h';
  }

  /** A table cell showing the project's friendly name with its full path beneath. */
  private renderProjectCell(name: string, fullPath: string): string {
    const safeName = this.escapeHtml(name || 'unknown');
    const safePath = this.escapeHtml(fullPath || '');
    const pathLine = safePath ? '<div class="project-path" title="' + safePath + '">' + safePath + '</div>' : '';
    return '<td class="project-cell"><div class="project-name">' + safeName + '</div>' + pathLine + '</td>';
  }

  private renderProjectData(): string {
    if (!this.projectBreakdown || this.projectBreakdown.length === 0) {
      return '<div class="no-data"><p>' + I18n.t.popup.noDataMessage + '</p></div>';
    }

    const t = I18n.t.popup;

    const usageCells = (d: UsageData): string =>
      '<td class="cost-cell">' + I18n.formatCurrency(d.totalCost) + '</td>' +
      '<td class="number-cell">' + I18n.formatNumber(d.totalInputTokens) + '</td>' +
      '<td class="number-cell">' + I18n.formatNumber(d.totalOutputTokens) + '</td>' +
      '<td class="number-cell">' + I18n.formatNumber(d.totalCacheCreationTokens) + '</td>' +
      '<td class="number-cell">' + I18n.formatNumber(d.totalCacheReadTokens) + '</td>' +
      '<td class="number-cell">' + I18n.formatNumber(d.messageCount) + '</td>';

    let rows = '';
    this.projectBreakdown.forEach((group, idx) => {
      const groupId = 'pg' + idx;
      const sortAttrs =
        ' data-sort-name="' + this.escapeHtml(group.groupName.toLowerCase()) + '"' +
        ' data-sort-sessions="' + group.sessionCount + '"' +
        ' data-sort-lastactive="' + group.lastSeen.getTime() + '"' +
        this.usageSortAttrs(group.data);

      if (group.children.length <= 1) {
        // A single project — render as one plain, sortable row.
        const only = group.children[0];
        const name = only ? only.projectName : group.groupName;
        const path = only ? only.projectPath : group.groupPath;
        rows +=
          '<tr class="sort-row"' + sortAttrs + '>' +
          this.renderProjectCell(name, path) +
          '<td class="number-cell">' + I18n.formatNumber(group.sessionCount) + '</td>' +
          usageCells(group.data) +
          '<td class="date-cell">' + this.escapeHtml(this.formatDateTime(group.lastSeen)) + '</td>' +
          '</tr>';
      } else {
        // Several projects under one folder — an expandable group row.
        rows +=
          '<tr class="sort-row project-group-row" data-group="' + groupId + '"' + sortAttrs + '>' +
          '<td class="project-cell">' +
          '<div class="project-name">' +
          '<span class="group-toggle" onclick="toggleProjectGroup(\'' + groupId + '\')">▶</span> ' +
          (group.isGitRepo ? '<span class="git-badge">git</span> ' : '') +
          this.escapeHtml(group.groupName) +
          ' <span class="group-count">(' + group.projectCount + ')</span>' +
          '</div>' +
          '<div class="project-path" title="' + this.escapeHtml(group.groupPath) + '">' +
          this.escapeHtml(group.groupPath) +
          '</div>' +
          '</td>' +
          '<td class="number-cell">' + I18n.formatNumber(group.sessionCount) + '</td>' +
          usageCells(group.data) +
          '<td class="date-cell">' + this.escapeHtml(this.formatDateTime(group.lastSeen)) + '</td>' +
          '</tr>';
        group.children.forEach((child) => {
          rows +=
            '<tr class="sort-child project-child-row" data-group="' + groupId + '" style="display:none;">' +
            '<td class="project-cell project-child-cell">' +
            '<div class="project-name">' + this.escapeHtml(child.projectName) + '</div>' +
            '<div class="project-path" title="' + this.escapeHtml(child.projectPath) + '">' +
            this.escapeHtml(child.projectPath) +
            '</div>' +
            '</td>' +
            '<td class="number-cell">' + I18n.formatNumber(child.sessionCount) + '</td>' +
            usageCells(child.data) +
            '<td class="date-cell">' + this.escapeHtml(this.formatDateTime(child.lastSeen)) + '</td>' +
            '</tr>';
        });
      }
    });

    const th = (key: string, label: string): string =>
      '<th class="sortable" data-sortkey="' + key + '">' + label + '</th>';

    return (
      '<div class="daily-breakdown">' +
      '<h3>' + t.projectBreakdown + '</h3>' +
      '<p class="table-hint">' + t.sortHint + '</p>' +
      '<div class="daily-table-container">' +
      '<table class="daily-table sortable-table">' +
      '<thead><tr>' +
      th('name', t.project) +
      th('sessions', t.sessions) +
      th('cost', t.cost) +
      th('input', t.inputTokens) +
      th('output', t.outputTokens) +
      th('cachecreate', t.cacheCreation) +
      th('cacheread', t.cacheRead) +
      th('messages', t.messages) +
      th('lastactive', t.lastActive) +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>'
    );
  }

  private renderBranchData(): string {
    if (!this.branchBreakdown || this.branchBreakdown.length === 0) {
      return '<div class="no-data"><p>' + I18n.t.popup.noDataMessage + '</p></div>';
    }

    const t = I18n.t.popup;

    let rows = '';
    this.branchBreakdown.forEach((b) => {
      const d = b.data;
      rows +=
        '<tr class="sort-row"' +
        ' data-sort-branch="' + this.escapeHtml(b.branch.toLowerCase()) + '"' +
        ' data-sort-project="' + this.escapeHtml((b.projectName || '').toLowerCase()) + '"' +
        ' data-sort-sessions="' + b.sessionCount + '"' +
        ' data-sort-lastactive="' + b.lastSeen.getTime() + '"' +
        this.usageSortAttrs(d) +
        '>' +
        '<td class="date-cell" title="' + this.escapeHtml(b.projectPath) + '">' + this.escapeHtml(b.branch) + '</td>' +
        '<td>' + this.escapeHtml(b.projectName) + '</td>' +
        '<td class="cost-cell">' + I18n.formatCurrency(d.totalCost) + '</td>' +
        '<td class="number-cell">' + I18n.formatNumber(d.totalInputTokens) + '</td>' +
        '<td class="number-cell">' + I18n.formatNumber(d.totalOutputTokens) + '</td>' +
        '<td class="number-cell">' + I18n.formatNumber(d.totalCacheCreationTokens) + '</td>' +
        '<td class="number-cell">' + I18n.formatNumber(d.totalCacheReadTokens) + '</td>' +
        '<td class="number-cell">' + I18n.formatNumber(d.messageCount) + '</td>' +
        '<td class="number-cell">' + I18n.formatNumber(b.sessionCount) + '</td>' +
        '<td class="date-cell">' + this.escapeHtml(this.formatDateTime(b.lastSeen)) + '</td>' +
        '</tr>';
    });

    const th = (key: string, label: string): string =>
      '<th class="sortable" data-sortkey="' + key + '">' + label + '</th>';

    return (
      '<div class="daily-breakdown">' +
      '<h3>' + t.branchBreakdown + '</h3>' +
      '<p class="table-hint">' + t.sortHint + '</p>' +
      '<div class="daily-table-container">' +
      '<table class="daily-table sortable-table">' +
      '<thead><tr>' +
      th('branch', t.branch) +
      th('project', t.project) +
      th('cost', t.cost) +
      th('input', t.inputTokens) +
      th('output', t.outputTokens) +
      th('cachecreate', t.cacheCreation) +
      th('cacheread', t.cacheRead) +
      th('messages', t.messages) +
      th('sessions', t.sessions) +
      th('lastactive', t.lastActive) +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>'
    );
  }

  /**
   * "Content" tab: an estimated breakdown of which conversation content consumes
   * tokens (your prompts vs. tool results vs. assistant output), to help spot
   * habits worth optimising. Token figures are estimated from text length.
   */
  private renderContentData(): string {
    const t = I18n.t.popup;
    const analysis = this.contentAnalysis;
    if (!analysis || analysis.categories.length === 0 || analysis.totalEstimatedTokens === 0) {
      return '<div class="no-data"><p>' + I18n.t.popup.noDataMessage + '</p></div>';
    }

    const total = analysis.totalEstimatedTokens;

    const catLabel = (key: string): string => {
      switch (key) {
        case 'userPrompts':
          return t.catUserPrompts;
        case 'assistantText':
          return t.catAssistantText;
        case 'assistantThinking':
          return t.catAssistantThinking;
        case 'toolCalls':
          return t.catToolCalls;
        case 'toolResults':
          return t.catToolResults;
        default:
          return key;
      }
    };
    const catColor: Record<string, string> = {
      userPrompts: 'cf-1',
      assistantText: 'cf-2',
      assistantThinking: 'cf-3',
      toolCalls: 'cf-4',
      toolResults: 'cf-5',
    };

    const barRow = (label: string, tokens: number, barMax: number, colorClass: string): string => {
      const pct = total > 0 ? (tokens / total) * 100 : 0;
      const width = barMax > 0 ? (tokens / barMax) * 100 : 0;
      return (
        '<div class="cbar-row">' +
        '<div class="cbar-label" title="' + this.escapeHtml(label) + '">' + this.escapeHtml(label) + '</div>' +
        '<div class="cbar-track"><div class="cbar-fill ' + colorClass + '" style="width: ' + width.toFixed(1) + '%;"></div></div>' +
        '<div class="cbar-val">' + I18n.formatNumber(tokens) + '</div>' +
        '<div class="cbar-pct">' + pct.toFixed(1) + '%</div>' +
        '</div>'
      );
    };

    const maxCat = Math.max(...analysis.categories.map((c) => c.estimatedTokens), 1);
    let catRows = '';
    analysis.categories.forEach((c) => {
      catRows += barRow(catLabel(c.key), c.estimatedTokens, maxCat, catColor[c.key] || 'cf-1');
    });

    let toolSection = '';
    if (analysis.toolResultBreakdown.length > 0) {
      const maxTool = Math.max(...analysis.toolResultBreakdown.map((s) => s.estimatedTokens), 1);
      let toolRows = '';
      analysis.toolResultBreakdown.forEach((s) => {
        toolRows += barRow(s.key, s.estimatedTokens, maxTool, 'cf-4');
      });
      toolSection = '<h4 class="cbar-subhead">' + t.byTool + '</h4><div class="cbar-list">' + toolRows + '</div>';
    }

    return (
      '<div class="daily-breakdown">' +
      '<div class="section-header"><h3>' + t.contentAnalysis + '</h3>' +
      '<span class="section-header-right">' +
      '<span class="cbar-total">' + t.estTokens + ': ~' + I18n.formatNumber(total) + '</span>' +
      '<button class="btn-secondary btn-small" onclick="getAdvice()">✨ ' + t.getAdvice + '</button>' +
      '</span></div>' +
      '<p class="table-hint">' + t.last30days + ' · ' + t.estimatedNote + '</p>' +
      '<div class="cbar-list">' + catRows + '</div>' +
      toolSection +
      '</div>'
    );
  }

  /**
   * Static stacked-bar chart breaking each period into input / cache-read /
   * cache-write / output tokens — a finer view than the single-metric chart.
   */
  private renderCompositionChart(items: { label: string; data: UsageData }[]): string {
    if (!items || items.length === 0) {
      return '';
    }

    const t = I18n.t.popup;
    const maxHeight = 120;
    const totals = items.map(
      (it) =>
        it.data.totalInputTokens + it.data.totalOutputTokens + it.data.totalCacheCreationTokens + it.data.totalCacheReadTokens
    );
    const maxTotal = Math.max(...totals, 1);

    let bars = '';
    items.forEach((it, idx) => {
      const d = it.data;
      const total = totals[idx];
      const barHeight = (total / maxTotal) * maxHeight;
      const seg = (value: number, cls: string, label: string): string => {
        const h = total > 0 ? (value / total) * barHeight : 0;
        return (
          '<div class="stack-seg ' +
          cls +
          '" style="height: ' +
          h +
          'px;" title="' +
          this.escapeHtml(label) +
          ': ' +
          I18n.formatNumber(value) +
          '"></div>'
        );
      };
      bars +=
        '<div class="hc-col">' +
        '<div class="stack-bar" title="' +
        this.escapeHtml(it.label) +
        ': ' +
        I18n.formatNumber(total) +
        '">' +
        seg(d.totalInputTokens, 'seg-input', t.inputTokens) +
        seg(d.totalCacheReadTokens, 'seg-cache-read', t.cacheRead) +
        seg(d.totalCacheCreationTokens, 'seg-cache-creation', t.cacheCreation) +
        seg(d.totalOutputTokens, 'seg-output', t.outputTokens) +
        '</div>' +
        '</div>';
    });

    const xlabels = items.map((it) => '<div class="hc-xlabel">' + this.escapeHtml(it.label) + '</div>').join('');

    const dot = (cls: string, label: string): string =>
      '<span class="legend-item"><span class="legend-dot ' + cls + '"></span>' + label + '</span>';

    return (
      '<div class="composition-chart">' +
      '<h4>' +
      t.tokenComposition +
      '</h4>' +
      '<div class="stack-legend">' +
      dot('seg-input', t.inputTokens) +
      dot('seg-cache-read', t.cacheRead) +
      dot('seg-cache-creation', t.cacheCreation) +
      dot('seg-output', t.outputTokens) +
      '</div>' +
      '<div class="hc-wrap">' +
      '<div class="hc-yaxis">' +
      '<span class="hc-yval">' + I18n.formatNumber(maxTotal) + '</span>' +
      '<span class="hc-yval">' + I18n.formatNumber(Math.round(maxTotal / 2)) + '</span>' +
      '<span class="hc-yval">0</span>' +
      '</div>' +
      '<div class="hc-main"><div class="hc-scroll">' +
      '<div class="hc-plot">' +
      '<div class="hc-grid hc-grid-top"></div>' +
      '<div class="hc-grid hc-grid-mid"></div>' +
      '<div class="hc-bars">' +
      bars +
      '</div>' +
      '</div>' +
      '<div class="hc-xlabels">' +
      xlabels +
      '</div>' +
      '</div></div>' +
      '</div>' +
      '</div>'
    );
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

  /**
   * Today's hourly chart. Unlike the other charts it has a Y-axis, two dashed
   * reference lines and a value label on top of every bar, so figures are
   * readable without hovering.
   */
  private renderHourlyChart(): string {
    if (this.hourlyDataForToday.length === 0) {
      return '<div class="no-chart-data">No data available</div>';
    }

    const sortedData = [...this.hourlyDataForToday].sort((a, b) => a.hour.localeCompare(b.hour));
    const maxCost = Math.max(...sortedData.map((d) => d.data.totalCost), 0);
    const maxHeight = 120; // Plot height in pixels — kept in sync with updateMainChart.

    const bars = sortedData
      .map(({ hour, data }) => {
        const height = maxCost > 0 ? (data.totalCost / maxCost) * maxHeight : 0;
        return (
          '<div class="hc-col" data-hour="' + hour + '">' +
          '<div class="hc-barval">' + I18n.formatCurrency(data.totalCost) + '</div>' +
          '<div class="chart-bar cost-bar" style="height: ' + height + 'px;" ' +
          'data-cost="' + data.totalCost + '" ' +
          'data-input="' + data.totalInputTokens + '" ' +
          'data-output="' + data.totalOutputTokens + '" ' +
          'data-cache-creation="' + data.totalCacheCreationTokens + '" ' +
          'data-cache-read="' + data.totalCacheReadTokens + '" ' +
          'data-messages="' + data.messageCount + '" ' +
          'title="' + I18n.formatCurrency(data.totalCost) + '"></div>' +
          '</div>'
        );
      })
      .join('');

    const xlabels = sortedData.map(({ hour }) => '<div class="hc-xlabel">' + hour + '</div>').join('');

    return (
      '<div class="hc-wrap">' +
      '<div class="hc-yaxis">' +
      '<span class="hc-yval">' + I18n.formatCurrency(maxCost) + '</span>' +
      '<span class="hc-yval">' + I18n.formatCurrency(maxCost / 2) + '</span>' +
      '<span class="hc-yval">' + I18n.formatCurrency(0) + '</span>' +
      '</div>' +
      '<div class="hc-main">' +
      '<div class="hc-scroll">' +
      '<div class="hc-plot" id="hourlyChart">' +
      '<div class="hc-grid hc-grid-top"></div>' +
      '<div class="hc-grid hc-grid-mid"></div>' +
      '<div class="hc-bars">' + bars + '</div>' +
      '</div>' +
      '<div class="hc-xlabels">' + xlabels + '</div>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
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

      .project-cell {
        max-width: 340px;
      }

      .project-name {
        font-weight: bold;
        color: var(--vscode-symbolIcon-functionForeground);
      }

      .project-path {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        word-break: break-all;
        margin-top: 2px;
      }

      .composition-chart {
        margin: 12px 0 20px;
      }

      .cost-composition {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--vscode-panel-border);
      }

      .cost-comp-head {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 6px;
      }

      .cost-comp-bar {
        display: flex;
        height: 14px;
        border-radius: 3px;
        overflow: hidden;
        background: var(--vscode-input-background);
      }

      .cost-comp-seg {
        height: 100%;
      }

      .cost-comp-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-top: 6px;
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
      }

      .composition-chart h4 {
        margin: 0 0 8px 0;
        font-size: 13px;
      }

      .stack-legend {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
        margin-bottom: 8px;
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
      }

      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 2px;
        display: inline-block;
      }

      .stack-bar {
        width: 24px;
        display: flex;
        flex-direction: column-reverse;
        border-radius: 2px 2px 0 0;
        overflow: hidden;
        margin-bottom: 8px;
        min-height: 2px;
      }

      .stack-seg {
        width: 100%;
      }

      .seg-input {
        background: var(--vscode-charts-blue);
      }

      .seg-output {
        background: var(--vscode-charts-orange);
      }

      .seg-cache-creation {
        background: var(--vscode-charts-purple);
      }

      .seg-cache-read {
        background: var(--vscode-charts-green);
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        gap: 12px;
      }

      .section-header h3 {
        margin: 0;
      }

      .section-header-right {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }

      .btn-small {
        padding: 4px 10px;
        font-size: 11px;
        white-space: nowrap;
      }

      .model-pricing {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed var(--vscode-panel-border);
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        word-break: break-word;
      }

      .table-hint {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        margin: 0 0 8px 0;
      }

      th.sortable {
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
      }

      th.sortable:hover {
        color: var(--vscode-focusBorder);
      }

      th.sortable.sorted-asc::after {
        content: ' \\25B2';
        font-size: 9px;
      }

      th.sortable.sorted-desc::after {
        content: ' \\25BC';
        font-size: 9px;
      }

      .group-toggle {
        display: inline-block;
        width: 14px;
        cursor: pointer;
        color: var(--vscode-descriptionForeground);
        transition: transform 0.15s ease;
      }

      .group-toggle.expanded {
        transform: rotate(90deg);
      }

      .group-count {
        font-weight: normal;
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
      }

      .project-child-cell {
        padding-left: 28px;
      }

      .project-child-row {
        background: var(--vscode-input-background);
      }

      .hc-wrap {
        display: flex;
        gap: 6px;
        margin-bottom: 20px;
        padding-top: 18px;
      }

      .hc-yaxis {
        width: 62px;
        height: 120px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        text-align: right;
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
      }

      .hc-yval {
        line-height: 1;
        white-space: nowrap;
      }

      .hc-main {
        flex: 1;
        min-width: 0;
      }

      .hc-scroll {
        overflow-x: auto;
        overflow-y: visible;
      }

      .hc-plot {
        position: relative;
        height: 120px;
        min-width: fit-content;
        border-bottom: 1px solid var(--vscode-panel-border);
      }

      .hc-grid {
        position: absolute;
        left: 0;
        right: 0;
        border-top: 1px dashed var(--vscode-panel-border);
        opacity: 0.6;
        pointer-events: none;
      }

      .hc-grid-top {
        top: 0;
      }

      .hc-grid-mid {
        top: 50%;
      }

      .hc-bars {
        display: flex;
        align-items: flex-end;
        gap: 4px;
        height: 120px;
        min-width: fit-content;
      }

      .hc-col {
        width: 38px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
      }

      .hc-col .chart-bar,
      .hc-col .stack-bar {
        margin-bottom: 0;
      }

      .hc-barval {
        font-size: 9px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 2px;
        white-space: nowrap;
      }

      .hc-xlabels {
        display: flex;
        gap: 4px;
        min-width: fit-content;
        margin-top: 4px;
      }

      .hc-xlabel {
        width: 38px;
        flex-shrink: 0;
        text-align: center;
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
      }

      .git-badge {
        display: inline-block;
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 1px 5px;
        border-radius: 3px;
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        vertical-align: middle;
      }

      .cbar-total {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }

      .cbar-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 8px 0 16px;
      }

      .cbar-subhead {
        margin: 16px 0 4px;
        font-size: 14px;
      }

      .cbar-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 12px;
      }

      .cbar-label {
        width: 160px;
        flex-shrink: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .cbar-track {
        flex: 1;
        height: 16px;
        min-width: 40px;
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 3px;
        overflow: hidden;
      }

      .cbar-fill {
        height: 100%;
        border-radius: 2px;
        min-width: 1px;
      }

      .cbar-val {
        width: 96px;
        flex-shrink: 0;
        text-align: right;
        font-family: var(--vscode-editor-font-family);
      }

      .cbar-pct {
        width: 52px;
        flex-shrink: 0;
        text-align: right;
        color: var(--vscode-descriptionForeground);
      }

      .cf-1 {
        background: var(--vscode-charts-blue);
      }

      .cf-2 {
        background: var(--vscode-charts-orange);
      }

      .cf-3 {
        background: var(--vscode-charts-purple);
      }

      .cf-4 {
        background: var(--vscode-charts-green);
      }

      .cf-5 {
        background: var(--vscode-charts-red);
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

function refreshPricing() {
  console.log("[DEBUG] refreshPricing called");
  vscode.postMessage({ command: 'refreshPricing' });
}

function getAdvice() {
  console.log("[DEBUG] getAdvice called");
  vscode.postMessage({ command: 'getAdvice' });
}

function toggleProjectGroup(groupId) {
  var groupRow = document.querySelector('.project-group-row[data-group="' + groupId + '"]');
  var childRows = document.querySelectorAll('.project-child-row[data-group="' + groupId + '"]');
  var toggle = groupRow ? groupRow.querySelector('.group-toggle') : null;
  var expanded = toggle && toggle.classList.contains('expanded');
  childRows.forEach(function(r) {
    r.style.display = expanded ? 'none' : 'table-row';
  });
  if (toggle) {
    toggle.classList.toggle('expanded');
    toggle.textContent = expanded ? '▶' : '▼';
  }
}

// Sort a table by a column key. Rows with class "sort-child" travel with the
// preceding "sort-row" (used for expandable project groups).
function sortTable(table, key, th) {
  var tbody = table.querySelector('tbody');
  if (!tbody) { return; }
  var allRows = Array.prototype.slice.call(tbody.children);

  var units = [];
  var current = null;
  allRows.forEach(function(row) {
    if (row.classList.contains('sort-child') && current) {
      current.rows.push(row);
    } else {
      current = { lead: row, rows: [row] };
      units.push(current);
    }
  });

  // First click on a column sorts descending; clicking again flips direction.
  var ascending = th.getAttribute('data-sortdir') === 'desc';

  table.querySelectorAll('th.sortable').forEach(function(h) {
    h.removeAttribute('data-sortdir');
    h.classList.remove('sorted-asc', 'sorted-desc');
  });
  th.setAttribute('data-sortdir', ascending ? 'asc' : 'desc');
  th.classList.add(ascending ? 'sorted-asc' : 'sorted-desc');

  units.sort(function(a, b) {
    var va = a.lead.getAttribute('data-sort-' + key);
    var vb = b.lead.getAttribute('data-sort-' + key);
    if (va === null) { va = ''; }
    if (vb === null) { vb = ''; }
    var na = parseFloat(va);
    var nb = parseFloat(vb);
    var cmp;
    if (va !== '' && vb !== '' && !isNaN(na) && !isNaN(nb)) {
      cmp = na - nb;
    } else {
      cmp = String(va).localeCompare(String(vb));
    }
    return ascending ? cmp : -cmp;
  });

  units.forEach(function(u) {
    u.rows.forEach(function(r) { tbody.appendChild(r); });
  });
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
window.refreshPricing = refreshPricing;
window.getAdvice = getAdvice;
window.toggleProjectGroup = toggleProjectGroup;
window.sortTable = sortTable;
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

  // Handle sortable table header clicks
  var sortableTh = event.target.closest ? event.target.closest('th.sortable') : null;
  if (sortableTh) {
    var sortTableEl = sortableTh.closest('table');
    var sortKey = sortableTh.getAttribute('data-sortkey');
    if (sortTableEl && sortKey) {
      sortTable(sortTableEl, sortKey, sortableTh);
    }
    return;
  }

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

    // Update tooltip + on-bar value label
    const formattedValue = formatValue(value, metric);
    const container = bar.parentElement;
    const date = container.dataset.date;
    const hour = container.dataset.hour;

    if (hour) {
      // Hourly chart: tooltip shows the value only (the hour is on the x-axis).
      bar.title = formattedValue;
    } else if (date) {
      const dateObj = new Date(date);
      bar.title = dateObj.toLocaleDateString() + ': ' + formattedValue;
    }

    const barVal = container.querySelector('.hc-barval');
    if (barVal) {
      barVal.textContent = formattedValue;
    }
  });

  // Update the hourly chart's Y-axis reference labels, if present.
  const yvals = targetContainer.querySelectorAll('.hc-yaxis .hc-yval');
  if (yvals.length === 3) {
    yvals[0].textContent = formatValue(maxValue, metric);
    yvals[1].textContent = formatValue(maxValue / 2, metric);
    yvals[2].textContent = formatValue(0, metric);
  }
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
