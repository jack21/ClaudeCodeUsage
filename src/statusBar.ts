import * as vscode from 'vscode';
import { ClaudeApiUsageResponse, ClaudeUsageLimit, SessionData, UsageData } from './types';
import { I18n } from './i18n';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private quotaItem: vscode.StatusBarItem;
  private isLoading: boolean = false;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'claudeCodeUsage.showDetails';
    this.statusBarItem.show();

    // A second, quieter item for the real usage-limit indicator.
    this.quotaItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    this.quotaItem.command = 'claudeCodeUsage.showDetails';

    this.updateStatusBar();
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.updateStatusBar();
  }

  updateUsageData(
    todayData: UsageData | null,
    sessionData?: SessionData | null,
    error?: string,
    usageLimits?: ClaudeApiUsageResponse | null
  ): void {
    // Quota is account-level and decoupled from local-data state: the caller
    // is expected to call updateQuota() separately so workspaces without
    // history still see it. We only touch the cost item here.
    this.isLoading = false;

    if (error) {
      this.showError(error);
      return;
    }

    if (!todayData) {
      this.showNoData();
      return;
    }

    this.showTodayData(todayData, sessionData ?? null);
    // The usageLimits arg is kept for callers that want a single-call update
    // path; quota was already refreshed earlier in this cycle.
    if (usageLimits !== undefined) {
      this.updateQuota(usageLimits);
    }
  }

  private updateStatusBar(): void {
    if (this.isLoading) {
      this.statusBarItem.text = `$(sync~spin) ${I18n.t.statusBar.loading}`;
      this.statusBarItem.tooltip = I18n.t.statusBar.loading;
      return;
    }
  }

  private showTodayData(todayData: UsageData, sessionData: SessionData | null): void {
    const todayCost = I18n.formatCurrency(todayData.totalCost);
    // Primary number = today's cost. When an active session exists, show its
    // cost as a secondary value so per-session spend is visible at a glance.
    let text = `$(pulse) ${todayCost}`;
    if (sessionData && sessionData.messageCount > 0) {
      text += ` $(history) ${I18n.formatCurrency(sessionData.totalCost)}`;
    }
    this.statusBarItem.text = text;

    this.statusBarItem.tooltip = this.createTooltip(todayData, sessionData);
    this.statusBarItem.backgroundColor = undefined;
  }

  /**
   * Update the quota indicator with real 5-hour / weekly utilisation from the
   * OAuth usage API. Hidden when the data is unavailable (e.g. not signed in).
   * Public so it can be refreshed on its own while the rest of the UI is idle.
   */
  updateQuota(usageLimits: ClaudeApiUsageResponse | null): void {
    const fiveHour = usageLimits?.five_hour;
    const weekly = usageLimits?.seven_day;
    if (!fiveHour && !weekly) {
      this.quotaItem.hide();
      return;
    }

    const parts: string[] = [];
    let worstPct = 0;
    if (fiveHour) {
      worstPct = Math.max(worstPct, fiveHour.utilization);
      parts.push(`5h:${Math.round(fiveHour.utilization)}%`);
    }
    if (weekly) {
      worstPct = Math.max(worstPct, weekly.utilization);
      parts.push(`wk:${Math.round(weekly.utilization)}%`);
    }

    this.quotaItem.text = `$(dashboard) ${parts.join(' ')}`;

    // Stay quiet until usage actually gets high.
    if (worstPct >= 95) {
      this.quotaItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (worstPct >= 80) {
      this.quotaItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.quotaItem.backgroundColor = undefined;
    }

    this.quotaItem.tooltip = this.createQuotaTooltip(usageLimits as ClaudeApiUsageResponse);
    this.quotaItem.show();
  }

  private showNoData(): void {
    this.statusBarItem.text = `$(circle-slash) ${I18n.t.statusBar.noData}`;
    this.statusBarItem.tooltip = I18n.t.statusBar.notRunning;
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }

  private showError(error: string): void {
    this.statusBarItem.text = `$(error) ${I18n.t.statusBar.error}`;
    this.statusBarItem.tooltip = error;
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }

  /**
   * Hover tooltip as a Markdown table so figures line up in neat, right-aligned
   * columns (a plain-text tooltip cannot align reliably).
   */
  private createTooltip(todayData: UsageData, sessionData: SessionData | null): vscode.MarkdownString {
    const t = I18n.t.popup;
    const session = sessionData && sessionData.messageCount > 0 ? sessionData : null;

    const md = new vscode.MarkdownString();
    md.supportThemeIcons = true;

    if (session) {
      md.appendMarkdown(`| | $(pulse) ${t.today} | $(history) ${I18n.t.statusBar.currentSession} |\n`);
      md.appendMarkdown(`|:--|--:|--:|\n`);
    } else {
      md.appendMarkdown(`| | $(pulse) ${t.today} |\n`);
      md.appendMarkdown(`|:--|--:|\n`);
    }

    const row = (label: string, todayValue: string, sessionValue: string): void => {
      md.appendMarkdown(session ? `| ${label} | ${todayValue} | ${sessionValue} |\n` : `| ${label} | ${todayValue} |\n`);
    };

    row(t.cost, I18n.formatCurrency(todayData.totalCost), session ? I18n.formatCurrency(session.totalCost) : '');
    row(
      t.inputTokens,
      I18n.formatNumber(todayData.totalInputTokens),
      session ? I18n.formatNumber(session.totalInputTokens) : ''
    );
    row(
      t.outputTokens,
      I18n.formatNumber(todayData.totalOutputTokens),
      session ? I18n.formatNumber(session.totalOutputTokens) : ''
    );
    row(
      t.cacheCreation,
      I18n.formatNumber(todayData.totalCacheCreationTokens),
      session ? I18n.formatNumber(session.totalCacheCreationTokens) : ''
    );
    row(
      t.cacheRead,
      I18n.formatNumber(todayData.totalCacheReadTokens),
      session ? I18n.formatNumber(session.totalCacheReadTokens) : ''
    );
    row(t.messages, I18n.formatNumber(todayData.messageCount), session ? I18n.formatNumber(session.messageCount) : '');

    md.appendMarkdown(`\n\n*Click for detailed breakdown*`);
    return md;
  }

  private createQuotaTooltip(usageLimits: ClaudeApiUsageResponse): vscode.MarkdownString {
    const t = I18n.t.popup;
    const md = new vscode.MarkdownString();
    md.supportThemeIcons = true;
    md.supportHtml = true;
    md.appendMarkdown(`**${t.quota}**\n\n`);
    // HTML table with embedded SVG progress bars. SVG is the most reliable
    // VS Code can render inside a Markdown tooltip — it survives the markdown
    // sanitiser, looks identical on light and dark themes, and lets us pick
    // bar colour by threshold so a near-full quota visually screams.
    md.appendMarkdown(`<table>\n`);
    md.appendMarkdown(
      `<tr><th align="left">${t.quotaWindow}</th>` +
      `<th></th><th align="right">${t.share}</th>` +
      `<th align="right">${t.resets}</th></tr>\n`
    );
    if (usageLimits.five_hour) {
      md.appendMarkdown(this.quotaRowHtml(t.quota5h, usageLimits.five_hour, false));
    }
    if (usageLimits.seven_day) {
      md.appendMarkdown(this.quotaRowHtml(t.quotaWeekly, usageLimits.seven_day, true));
    }
    if (usageLimits.seven_day_opus) {
      md.appendMarkdown(this.quotaRowHtml(`${t.quotaWeekly} (Opus)`, usageLimits.seven_day_opus, true));
    }
    md.appendMarkdown(`</table>\n\n*${t.quotaHint}*`);
    return md;
  }

  /** Build one row of the quota tooltip table, with an SVG progress bar. */
  private quotaRowHtml(label: string, limit: ClaudeUsageLimit, weekly: boolean): string {
    const resetDate = new Date(limit.resets_at);
    const resets = isNaN(resetDate.getTime())
      ? '—'
      : weekly
        ? `${this.formatWeeklyReset(resetDate)}<br>${this.formatCountdown(resetDate)}`
        : this.formatCountdown(resetDate);
    const pct = Math.max(0, Math.min(100, limit.utilization));
    const bar = this.progressBarSvg(pct);
    return (
      `<tr>` +
      `<td align="left"><b>${label}</b></td>` +
      `<td>${bar}</td>` +
      `<td align="right">${pct.toFixed(1)}%</td>` +
      `<td align="right">${resets}</td>` +
      `</tr>\n`
    );
  }

  /** Progress bar built from four side-by-side coloured <span>s. VS Code's
   * tooltip Markdown sanitiser strips most CSS, but `background-color` and
   * `font-size` reliably survive on `<span>` — so we build the bar from
   * adjacent solid-coloured cells:
   *
   *   [dark-gray-bookend][fill-coloured filled cells][light-gray empty][dark-gray-bookend]
   *
   * The dark-gray bookends mark the 0% and 100% boundaries with a strong
   * contrast that's visible on both light and dark themes; the medium-gray
   * empty cells make the unfilled range obvious without competing with the
   * coloured fill.
   *
   * Bar colour mirrors the status-bar warning/error thresholds (amber at
   * >=80%, red at >=95%) so the visual signal matches the indicator. */
  private progressBarSvg(pct: number): string {
    const TOTAL = 20; // fill segments between the two bookends
    const filled = Math.max(0, Math.min(TOTAL, Math.round((pct / 100) * TOTAL)));
    const empty = TOTAL - filled;
    let color = '#4caf50';                    // green
    if (pct >= 95) { color = '#f44336'; }     // red
    else if (pct >= 80) { color = '#ff9800'; } // amber
    const nbsp = (n: number) => '&nbsp;'.repeat(n);
    // font-size 48% squashes height into a thin strip. Theme-neutral colours:
    //   #666 dark-gray bookends (visible on light AND dark backgrounds)
    //   #cccccc empty fill (clearly different from the bookends)
    const SIZE = 'font-size:48%';
    return (
      `<span style="background-color:#666;${SIZE};">&nbsp;</span>` +
      `<span style="background-color:${color};${SIZE};">${nbsp(filled)}</span>` +
      `<span style="background-color:#cccccc;${SIZE};">${nbsp(empty)}</span>` +
      `<span style="background-color:#666;${SIZE};">&nbsp;</span>`
    );
  }

    /** Time remaining until a reset, e.g. "2h 15m" or "3d 4h". */
  private formatCountdown(target: Date): string {
    const ms = target.getTime() - Date.now();
    if (ms <= 0) {
      return '0m';
    }
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours >= 24) {
      return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    }
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  /** Localised weekday + time of a weekly reset, in 24-hour form
   * (e.g. "Wed 03:00"). hour12:false suppresses AM/PM that some locales add. */
  private formatWeeklyReset(target: Date): string {
    try {
      return target.toLocaleString(undefined, {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return target.toISOString();
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
    this.quotaItem.dispose();
  }
}
