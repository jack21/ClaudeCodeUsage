import * as vscode from 'vscode';
import { SessionData, UsageData } from './types';
import { I18n } from './i18n';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private isLoading: boolean = false;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'claudeCodeUsage.showDetails';
    this.statusBarItem.show();
    this.updateStatusBar();
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.updateStatusBar();
  }

  updateUsageData(todayData: UsageData | null, sessionData?: SessionData | null, error?: string): void {
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
   * Build the hover tooltip as a Markdown table so figures line up in neat,
   * right-aligned columns (a plain-text tooltip cannot align reliably).
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

    row(
      t.cost,
      I18n.formatCurrency(todayData.totalCost),
      session ? I18n.formatCurrency(session.totalCost) : ''
    );
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
    row(
      t.messages,
      I18n.formatNumber(todayData.messageCount),
      session ? I18n.formatNumber(session.messageCount) : ''
    );

    md.appendMarkdown(`\n\n*Click for detailed breakdown*`);

    return md;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
