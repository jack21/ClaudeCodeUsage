import * as vscode from 'vscode';
import { UsageData, ClaudeApiUsageResponse } from './types';
import { I18n } from './i18n';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private isLoading: boolean = false;
  private usageLimits: ClaudeApiUsageResponse | null = null;

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

  updateUsageData(todayData: UsageData | null, error?: string, usageLimits?: ClaudeApiUsageResponse | null): void {
    this.isLoading = false;

    if (usageLimits !== undefined) {
      this.usageLimits = usageLimits;
    }

    if (error) {
      this.showError(error);
      return;
    }

    if (!todayData) {
      this.showNoData();
      return;
    }

    this.showTodayData(todayData);
  }

  private updateStatusBar(): void {
    if (this.isLoading) {
      this.statusBarItem.text = `$(sync~spin) ${I18n.t.statusBar.loading}`;
      this.statusBarItem.tooltip = I18n.t.statusBar.loading;
      return;
    }
  }

  private showTodayData(todayData: UsageData): void {
    const cost = I18n.formatCurrency(todayData.totalCost);
    let text = `$(pulse) ${cost}`;

    // Append usage limits if available
    if (this.usageLimits?.five_hour || this.usageLimits?.seven_day) {
      const parts: string[] = [];
      if (this.usageLimits.five_hour) {
        parts.push(`5h:${Math.round(this.usageLimits.five_hour.utilization)}% |`);
      }
      if (this.usageLimits.seven_day) {
        parts.push(`7d:${Math.round(this.usageLimits.seven_day.utilization)}%`);
      }
      text += ` | ${parts.join(' ')}`;
    }

    this.statusBarItem.text = text;

    const tooltip = this.createTooltip(todayData);
    this.statusBarItem.tooltip = tooltip;

    // Warn if either limit is high
    const fiveHourHigh = this.usageLimits?.five_hour && this.usageLimits.five_hour.utilization >= 80;
    const weeklyHigh = this.usageLimits?.seven_day && this.usageLimits.seven_day.utilization >= 80;
    if (fiveHourHigh || weeklyHigh) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.statusBarItem.backgroundColor = undefined;
    }
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

  private createTooltip(todayData: UsageData): string {
    const lines = [
      `${I18n.t.popup.today}:`,
      `${I18n.t.popup.cost}: ${I18n.formatCurrency(todayData.totalCost)}`,
      `${I18n.t.popup.inputTokens}: ${I18n.formatNumber(todayData.totalInputTokens)}`,
      `${I18n.t.popup.outputTokens}: ${I18n.formatNumber(todayData.totalOutputTokens)}`,
      `${I18n.t.popup.messages}: ${I18n.formatNumber(todayData.messageCount)}`
    ];

    // Add usage limits if available
    if (this.usageLimits) {
      lines.push('');
      lines.push('Usage Limits:');

      if (this.usageLimits.five_hour) {
        const resetDate = new Date(this.usageLimits.five_hour.resets_at);
        const hoursUntilReset = Math.max(0, (resetDate.getTime() - Date.now()) / (1000 * 60 * 60));
        lines.push(`5-Hour: ${this.usageLimits.five_hour.utilization.toFixed(1)}% (resets in ${hoursUntilReset.toFixed(1)}h)`);
      }

      if (this.usageLimits.seven_day) {
        const resetDate = new Date(this.usageLimits.seven_day.resets_at);
        const daysUntilReset = Math.max(0, (resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        lines.push(`Weekly: ${this.usageLimits.seven_day.utilization.toFixed(1)}% (resets in ${daysUntilReset.toFixed(1)}d)`);
      }
    }

    lines.push('');
    lines.push('Click for detailed breakdown');

    return lines.join('\n');
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}