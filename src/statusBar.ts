import * as vscode from 'vscode';
import { UsageData } from './types';
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

  updateUsageData(todayData: UsageData | null, error?: string): void {
    this.isLoading = false;
    
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
    this.statusBarItem.text = `$(pulse) ${cost}`;
    
    const tooltip = this.createTooltip(todayData);
    this.statusBarItem.tooltip = tooltip;
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

  private createTooltip(todayData: UsageData): string {
    const lines = [
      `${I18n.t.popup.today}:`,
      `${I18n.t.popup.cost}: ${I18n.formatCurrency(todayData.totalCost)}`,
      `${I18n.t.popup.inputTokens}: ${I18n.formatNumber(todayData.totalInputTokens)}`,
      `${I18n.t.popup.outputTokens}: ${I18n.formatNumber(todayData.totalOutputTokens)}`,
      `${I18n.t.popup.messages}: ${I18n.formatNumber(todayData.messageCount)}`,
      '',
      'Click for detailed breakdown'
    ];

    return lines.join('\n');
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}