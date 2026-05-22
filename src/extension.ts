import * as vscode from 'vscode';
import { ClaudeDataLoader } from './dataLoader';
import { StatusBarManager } from './statusBar';
import { UsageWebviewProvider } from './webview';
import { I18n } from './i18n';
import { fetchLatestPricing } from './pricing';
import { ClaudeApiClient } from './claudeApiClient';
import { getUsageAdvice } from './advisor';
import { ClaudeApiUsageResponse, ContentAnalysis, ExtensionConfig } from './types';

export class ClaudeCodeUsageExtension {
  private statusBar: StatusBarManager;
  private webviewProvider: UsageWebviewProvider;
  private apiClient: ClaudeApiClient;
  private refreshTimer: NodeJS.Timeout | undefined;
  private cache: {
    records: any[];
    contentAnalysis: ContentAnalysis | null;
    lastUpdate: Date;
    dataDirectory: string | null;
    usageLimits: ClaudeApiUsageResponse | null;
    usageLimitsLastUpdate: Date;
  } = {
    records: [],
    contentAnalysis: null,
    lastUpdate: new Date(0),
    dataDirectory: null,
    usageLimits: null,
    usageLimitsLastUpdate: new Date(0)
  };

  constructor(private context: vscode.ExtensionContext) {
    console.log('Claude Code Usage Extension: Constructor called');
    this.statusBar = new StatusBarManager();
    this.webviewProvider = new UsageWebviewProvider(context);
    this.apiClient = new ClaudeApiClient();

    this.setupCommands();
    this.loadConfiguration();
    this.startAutoRefresh();
    this.refreshData();
    console.log('Claude Code Usage Extension: Initialization complete');
  }

  private setupCommands(): void {
    const commands = [
      vscode.commands.registerCommand('claudeCodeUsage.refresh', () => {
        this.refreshData();
      }),
      vscode.commands.registerCommand('claudeCodeUsage.showDetails', () => {
        this.webviewProvider.show();
      }),
      vscode.commands.registerCommand('claudeCodeUsage.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'claudeCodeUsage');
      }),
      vscode.commands.registerCommand('claudeCodeUsage.refreshPricing', () => {
        this.refreshPricing();
      }),
      vscode.commands.registerCommand('claudeCodeUsage.getAdvice', () => {
        this.getAdvice();
      })
    ];

    commands.forEach(command => this.context.subscriptions.push(command));
  }

  private async refreshPricing(): Promise<void> {
    try {
      const result = await fetchLatestPricing();
      vscode.window.showInformationMessage(`${I18n.t.popup.pricingUpdated} (${result.updated})`);
      // Force a full recompute so the new prices take effect.
      this.cache.lastUpdate = new Date(0);
      this.refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`${I18n.t.popup.pricingUpdateFailed}: ${message}`);
    }
  }

  /** Build a compact, aggregate-only summary to send to the advice model. */
  private buildAdviceSummary(): string | null {
    const records = this.cache.records;
    const analysis = this.cache.contentAnalysis;
    if (!records || records.length === 0 || !analysis) {
      return null;
    }

    const allTime = ClaudeDataLoader.getAllTimeData(records);
    const lines: string[] = [];
    lines.push('Claude Code usage summary');
    lines.push(
      `All-time: cost $${allTime.totalCost.toFixed(2)}, input ${allTime.totalInputTokens}, ` +
        `output ${allTime.totalOutputTokens}, cache-write ${allTime.totalCacheCreationTokens}, ` +
        `cache-read ${allTime.totalCacheReadTokens}, messages ${allTime.messageCount}`
    );
    lines.push('');
    lines.push(`Content token breakdown (last 30 days, estimated, total ~${analysis.totalEstimatedTokens} tokens):`);
    for (const c of analysis.categories) {
      const pct =
        analysis.totalEstimatedTokens > 0
          ? ((c.estimatedTokens / analysis.totalEstimatedTokens) * 100).toFixed(1)
          : '0';
      lines.push(`- ${c.key}: ${c.estimatedTokens} (${pct}%)`);
    }
    if (analysis.toolResultBreakdown.length > 0) {
      lines.push('Tool results by tool:');
      for (const s of analysis.toolResultBreakdown.slice(0, 12)) {
        lines.push(`- ${s.key}: ${s.estimatedTokens}`);
      }
    }
    lines.push('');
    lines.push(`Models used: ${Object.keys(allTime.modelBreakdown).join(', ')}`);
    lines.push('');
    lines.push('Please give concrete, actionable advice to reduce token consumption and use Claude Code more efficiently.');
    return lines.join('\n');
  }

  private async getAdvice(): Promise<void> {
    const config = this.getConfiguration();
    if (!config.adviceApiKey || config.adviceApiKey.trim() === '') {
      const open = await vscode.window.showWarningMessage(I18n.t.popup.adviceNeedsKey, I18n.t.popup.settings);
      if (open) {
        vscode.commands.executeCommand('claudeCodeUsage.openSettings');
      }
      return;
    }

    const summary = this.buildAdviceSummary();
    if (!summary) {
      vscode.window.showWarningMessage(I18n.t.popup.noDataMessage);
      return;
    }

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: I18n.t.popup.adviceGenerating },
      async () => {
        try {
          const advice = await getUsageAdvice({
            apiKey: config.adviceApiKey,
            apiUrl: config.adviceApiUrl,
            model: config.adviceModel,
            summary
          });
          const doc = await vscode.workspace.openTextDocument({ content: advice, language: 'markdown' });
          await vscode.window.showTextDocument(doc);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`${I18n.t.popup.adviceFailed}: ${message}`);
        }
      }
    );
  }

  private loadConfiguration(): void {
    const config = this.getConfiguration();
    I18n.setLanguage(config.language as any);
    I18n.setDecimalPlaces(config.decimalPlaces);
    I18n.setCompactNumbers(config.compactNumbers);

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('claudeCodeUsage')) {
        this.onConfigurationChanged();
      }
    });
  }

  private getConfiguration(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('claudeCodeUsage');
    return {
      refreshInterval: config.get('refreshInterval', 60),
      dataDirectory: config.get('dataDirectory', ''),
      language: config.get('language', 'auto'),
      decimalPlaces: config.get('decimalPlaces', 2),
      compactNumbers: config.get('compactNumbers', false),
      usageLimitTracking: config.get('usageLimitTracking', true),
      adviceApiKey: config.get('adviceApiKey', ''),
      adviceApiUrl: config.get('adviceApiUrl', 'https://api.deepseek.com/v1/chat/completions'),
      adviceModel: config.get('adviceModel', 'deepseek-chat')
    };
  }

  private onConfigurationChanged(): void {
    const config = this.getConfiguration();
    I18n.setLanguage(config.language as any);
    I18n.setDecimalPlaces(config.decimalPlaces);
    I18n.setCompactNumbers(config.compactNumbers);

    // Restart auto-refresh with new interval
    this.startAutoRefresh();

    // Clear cache if data directory changed
    if (config.dataDirectory !== this.cache.dataDirectory) {
      this.cache.records = [];
      this.cache.lastUpdate = new Date(0);
      this.cache.dataDirectory = config.dataDirectory;
    }

    // Refresh data immediately
    this.refreshData();
  }

  private startAutoRefresh(): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    const config = this.getConfiguration();
    const intervalMs = Math.max(config.refreshInterval * 1000, 30000); // Minimum 30 seconds

    this.refreshTimer = setInterval(() => {
      this.refreshData();
    }, intervalMs);
  }

  /** Fetch real usage limits via OAuth, cached for 2 minutes. */
  private async maybeFetchUsageLimits(config: ExtensionConfig): Promise<ClaudeApiUsageResponse | null> {
    if (!config.usageLimitTracking) {
      return null;
    }
    const age = Date.now() - this.cache.usageLimitsLastUpdate.getTime();
    if (this.cache.usageLimits && age < 120000) {
      return this.cache.usageLimits;
    }
    const fetched = await this.apiClient.fetchUsageLimits();
    if (fetched) {
      this.cache.usageLimits = fetched;
      this.cache.usageLimitsLastUpdate = new Date();
      return fetched;
    }
    // Keep showing the last known value if a refresh fails.
    return this.cache.usageLimits;
  }

  private async refreshData(): Promise<void> {
    try {
      const config = this.getConfiguration();

      // Find Claude data directory
      const dataDirectory = await ClaudeDataLoader.findClaudeDataDirectory(
        config.dataDirectory || undefined
      );

      if (!dataDirectory) {
        const error = 'Claude data directory not found. Please check your configuration.';
        this.statusBar.updateUsageData(null, null, error);
        this.webviewProvider.updateData(null, null, null, null, [], [], [], error, null);
        return;
      }

      // Skip the heavy recompute when nothing has changed since the last load —
      // this avoids pointless work (and CPU spikes) while you are not running code.
      const latestMtime = await ClaudeDataLoader.getLatestModifiedTime(dataDirectory);
      const dirChanged = this.cache.dataDirectory !== dataDirectory;
      const needFullRefresh =
        dirChanged || this.cache.records.length === 0 || latestMtime > this.cache.lastUpdate.getTime();

      const usageLimits = await this.maybeFetchUsageLimits(config);

      if (!needFullRefresh) {
        // Idle: logs unchanged — only refresh the (independent) quota indicator.
        this.statusBar.updateQuota(usageLimits);
        return;
      }

      this.statusBar.setLoading(true);
      this.webviewProvider.setLoading(true);

      const loaded = await ClaudeDataLoader.loadUsageRecords(dataDirectory);
      const records = loaded.records;
      const contentAnalysis = loaded.contentAnalysis;
      this.cache.records = records;
      this.cache.contentAnalysis = contentAnalysis;
      this.cache.lastUpdate = new Date();
      this.cache.dataDirectory = dataDirectory;

      if (records.length === 0) {
        const error = 'No usage records found. Make sure Claude Code is running.';
        this.statusBar.updateUsageData(null, null, error);
        this.webviewProvider.updateData(null, null, null, null, [], [], [], error, dataDirectory);
        return;
      }

      // Calculate usage data
      const sessionData = ClaudeDataLoader.getCurrentSessionData(records);
      const todayData = ClaudeDataLoader.getTodayData(records);
      const monthData = ClaudeDataLoader.getThisMonthData(records);
      const allTimeData = ClaudeDataLoader.getAllTimeData(records);
      const dailyDataForMonth = ClaudeDataLoader.getDailyDataForMonth(records);
      const dailyDataForAllTime = ClaudeDataLoader.getDailyDataForAllTime(records);
      const hourlyDataForToday = ClaudeDataLoader.getHourlyDataForToday(records);
      const sessionBreakdown = ClaudeDataLoader.getSessionBreakdown(records);
      const projectBreakdown = ClaudeDataLoader.getProjectBreakdown(records);
      const branchBreakdown = ClaudeDataLoader.getBranchBreakdown(records);

      // Update UI
      this.statusBar.updateUsageData(todayData, sessionData, undefined, usageLimits);
      this.webviewProvider.updateData(sessionData, todayData, monthData, allTimeData, dailyDataForMonth, dailyDataForAllTime, hourlyDataForToday, undefined, dataDirectory, records, sessionBreakdown, projectBreakdown, contentAnalysis, branchBreakdown);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error refreshing Claude Code usage data:', error);

      this.statusBar.updateUsageData(null, null, errorMessage);
      this.webviewProvider.updateData(null, null, null, null, [], [], [], errorMessage, null);
    }
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.statusBar.dispose();
    this.webviewProvider.dispose();
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Code Usage extension is now active');

  const extension = new ClaudeCodeUsageExtension(context);
  context.subscriptions.push({
    dispose: () => extension.dispose()
  });
}

export function deactivate() {
  console.log('Claude Code Usage extension is now deactivated');
}
