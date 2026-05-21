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

  private createTooltip(todayData: UsageData, sessionData: SessionData | null): string {
    const t = I18n.t.popup;
    const lines: string[] = [
      `${t.today} ($(pulse)): ${I18n.formatCurrency(todayData.totalCost)}`,
      `  ${t.inputTokens}: ${I18n.formatNumber(todayData.totalInputTokens)}`,
      `  ${t.outputTokens}: ${I18n.formatNumber(todayData.totalOutputTokens)}`,
      `  ${t.cacheCreation}: ${I18n.formatNumber(todayData.totalCacheCreationTokens)}`,
      `  ${t.cacheRead}: ${I18n.formatNumber(todayData.totalCacheReadTokens)}`,
      `  ${t.messages}: ${I18n.formatNumber(todayData.messageCount)}`,
    ];

    if (sessionData && sessionData.messageCount > 0) {
      lines.push('');
      lines.push(`${I18n.t.statusBar.currentSession} ($(history)): ${I18n.formatCurrency(sessionData.totalCost)}`);
      lines.push(`  ${t.inputTokens}: ${I18n.formatNumber(sessionData.totalInputTokens)}`);
      lines.push(`  ${t.outputTokens}: ${I18n.formatNumber(sessionData.totalOutputTokens)}`);
      lines.push(`  ${t.cacheRead}: ${I18n.formatNumber(sessionData.totalCacheReadTokens)}`);
      lines.push(`  ${t.messages}: ${I18n.formatNumber(sessionData.messageCount)}`);
    }

    lines.push('');
    lines.push('Click for detailed breakdown');

    return lines.join('\n');
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
