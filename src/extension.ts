import * as vscode from 'vscode';
import { ClaudeDataLoader } from './dataLoader';
import { StatusBarManager } from './statusBar';
import { UsageWebviewProvider } from './webview';
import { I18n } from './i18n';
import { ExtensionConfig, UsageData, SessionData } from './types';

export class ClaudeCodeUsageExtension {
  private statusBar: StatusBarManager;
  private webviewProvider: UsageWebviewProvider;
  private refreshTimer: NodeJS.Timeout | undefined;
  private cache: {
    records: any[];
    lastUpdate: Date;
    dataDirectory: string | null;
  } = {
    records: [],
    lastUpdate: new Date(0),
    dataDirectory: null
  };

  constructor(private context: vscode.ExtensionContext) {
    console.log('Claude Code Usage Extension: Constructor called');
    this.statusBar = new StatusBarManager();
    this.webviewProvider = new UsageWebviewProvider(context);
    
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
      })
    ];

    commands.forEach(command => this.context.subscriptions.push(command));
  }

  private loadConfiguration(): void {
    const config = this.getConfiguration();
    I18n.setLanguage(config.language as any);
    
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
      decimalPlaces: config.get('decimalPlaces', 2)
    };
  }

  private onConfigurationChanged(): void {
    const config = this.getConfiguration();
    I18n.setLanguage(config.language as any);
    
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

  private async refreshData(): Promise<void> {
    try {
      this.statusBar.setLoading(true);
      this.webviewProvider.setLoading(true);

      const config = this.getConfiguration();
      
      // Find Claude data directory
      const dataDirectory = await ClaudeDataLoader.findClaudeDataDirectory(
        config.dataDirectory || undefined
      );

      if (!dataDirectory) {
        const error = 'Claude data directory not found. Please check your configuration.';
        this.statusBar.updateUsageData(null, error);
        this.webviewProvider.updateData(null, null, null, null, [], [], [], error, null);
        return;
      }

      // Check if we need to reload data
      const shouldReload = this.shouldReloadData(dataDirectory);
      
      let records = this.cache.records;
      if (shouldReload) {
        records = await ClaudeDataLoader.loadUsageRecords(dataDirectory);
        this.cache.records = records;
        this.cache.lastUpdate = new Date();
        this.cache.dataDirectory = dataDirectory;
      }

      if (records.length === 0) {
        const error = 'No usage records found. Make sure Claude Code is running.';
        this.statusBar.updateUsageData(null, error);
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

      // Update UI
      this.statusBar.updateUsageData(todayData);
      this.webviewProvider.updateData(sessionData, todayData, monthData, allTimeData, dailyDataForMonth, dailyDataForAllTime, hourlyDataForToday, undefined, dataDirectory, records);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error refreshing Claude Code usage data:', error);
      
      this.statusBar.updateUsageData(null, errorMessage);
      this.webviewProvider.updateData(null, null, null, null, [], [], [], errorMessage, null);
    }
  }

  private shouldReloadData(dataDirectory: string): boolean {
    // Always reload if directory changed
    if (this.cache.dataDirectory !== dataDirectory) {
      return true;
    }

    // Reload if cache is older than 1 minute
    const cacheAge = Date.now() - this.cache.lastUpdate.getTime();
    return cacheAge > 60000;
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