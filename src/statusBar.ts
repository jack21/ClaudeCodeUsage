import * as vscode from 'vscode';
import { SessionData, UsageData } from './types';
import { I18n } from './i18n';

// Quota-window usage vs. (optional) configured ceilings, with reset times.
export interface QuotaInfo {
  cost5h: number;
  limit5h: number;
  reset5h: Date | null;
  costWeek: number;
  limitWeek: number;
  resetWeek: Date | null;
}

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private quotaItem: vscode.StatusBarItem;
  private isLoading: boolean = false;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'claudeCodeUsage.showDetails';
    this.statusBarItem.show();

    // A second, quieter item for the rolling quota indicator.
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
    quota?: QuotaInfo
  ): void {
    this.isLoading = false;

    if (error) {
      this.showError(error);
      this.quotaItem.hide();
      return;
    }

    if (!todayData) {
      this.showNoData();
      this.quotaItem.hide();
      return;
    }

    this.showTodayData(todayData, sessionData ?? null);
    this.updateQuota(quota);
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

  /** Update the quota indicator. Hidden unless at least one limit is configured. */
  private updateQuota(quota?: QuotaInfo): void {
    if (!quota || (quota.limit5h <= 0 && quota.limitWeek <= 0)) {
      this.quotaItem.hide();
      return;
    }

    const parts: string[] = [];
    let worstPct = 0;
    if (quota.limit5h > 0) {
      const pct = Math.round((quota.cost5h / quota.limit5h) * 100);
      worstPct = Math.max(worstPct, pct);
      parts.push(`5h ${pct}%`);
    }
    if (quota.limitWeek > 0) {
      const pct = Math.round((quota.costWeek / quota.limitWeek) * 100);
      worstPct = Math.max(worstPct, pct);
      parts.push(`wk ${pct}%`);
    }

    this.quotaItem.text = `$(dashboard) ${parts.join(' · ')}`;

    // Stay quiet until usage actually gets high.
    if (worstPct >= 100) {
      this.quotaItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (worstPct >= 80) {
      this.quotaItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.quotaItem.backgroundColor = undefined;
    }

    this.quotaItem.tooltip = this.createQuotaTooltip(quota);
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

  private createQuotaTooltip(quota: QuotaInfo): vscode.MarkdownString {
    const t = I18n.t.popup;
    const md = new vscode.MarkdownString();
    md.supportThemeIcons = true;
    md.appendMarkdown(`**${t.quota}**\n\n`);
    md.appendMarkdown(`| ${t.quotaWindow} | ${t.cost} | ${t.quotaLimit} | % | ${t.resets} |\n`);
    md.appendMarkdown(`|:--|--:|--:|--:|--:|\n`);

    if (quota.limit5h > 0) {
      const pct = Math.round((quota.cost5h / quota.limit5h) * 100);
      const resets = quota.reset5h ? this.formatCountdown(quota.reset5h) : '—';
      md.appendMarkdown(
        `| ${t.quota5h} | ${I18n.formatCurrency(quota.cost5h)} | ${I18n.formatCurrency(quota.limit5h)} | ${pct}% | ${resets} |\n`
      );
    }
    if (quota.limitWeek > 0) {
      const pct = Math.round((quota.costWeek / quota.limitWeek) * 100);
      const resets = quota.resetWeek ? this.formatWeeklyReset(quota.resetWeek) : '—';
      md.appendMarkdown(
        `| ${t.quotaWeekly} | ${I18n.formatCurrency(quota.costWeek)} | ${I18n.formatCurrency(quota.limitWeek)} | ${pct}% | ${resets} |\n`
      );
    }

    md.appendMarkdown(`\n\n*${t.quotaHint}*`);
    return md;
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

  /** Localised weekday + time of a weekly reset, e.g. "Wed 03:00". */
  private formatWeeklyReset(target: Date): string {
    try {
      return target.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return target.toISOString();
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
    this.quotaItem.dispose();
  }
}
