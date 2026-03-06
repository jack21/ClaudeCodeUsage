import * as vscode from 'vscode';
import { ClaudeDataLoader } from './dataLoader';
import { StatusBarManager } from './statusBar';
import { UsageWebviewProvider } from './webview';
import { I18n } from './i18n';
import { ClaudeApiClient } from './claudeApiClient';
import { ExtensionConfig, UsageData, SessionData, ClaudeApiUsageResponse } from './types';

export class ClaudeCodeUsageExtension {
  private statusBar: StatusBarManager;
  private webviewProvider: UsageWebviewProvider;
  private apiClient: ClaudeApiClient;
  private refreshTimer: NodeJS.Timeout | undefined;
  private cache: {
    records: any[];
    lastUpdate: Date;
    dataDirectory: string | null;
    usageLimits: ClaudeApiUsageResponse | null;
    usageLimitsLastUpdate: Date;
  } = {
    records: [],
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
      console.log('[Extension] refreshData started');
      this.statusBar.setLoading(true);
      this.webviewProvider.setLoading(true);

      const config = this.getConfiguration();
      console.log('[Extension] Config:', { refreshInterval: config.refreshInterval, dataDirectory: config.dataDirectory });

      // Find Claude data directory
      console.log('[Extension] Finding Claude data directory...');
      const dataDirectory = await ClaudeDataLoader.findClaudeDataDirectory(
        config.dataDirectory || undefined
      );
      console.log('[Extension] Data directory found:', dataDirectory);

      if (!dataDirectory) {
        const error = 'Claude data directory not found. Please check your configuration.';
        console.error('[Extension]', error);
        this.statusBar.updateUsageData(null, error);
        this.webviewProvider.updateData(null, null, null, null, [], [], [], error, null);
        return;
      }

      // Check if we need to reload data
      const shouldReload = this.shouldReloadData(dataDirectory);
      console.log('[Extension] Should reload data:', shouldReload);

      let records = this.cache.records;
      if (shouldReload) {
        console.log('[Extension] Loading usage records...');
        records = await ClaudeDataLoader.loadUsageRecords(dataDirectory);
        console.log('[Extension] Loaded records:', records.length);
        this.cache.records = records;
        this.cache.lastUpdate = new Date();
        this.cache.dataDirectory = dataDirectory;
      } else {
        console.log('[Extension] Using cached records:', records.length);
      }

      // Fetch usage limits from API (cache for 2 minutes)
      const shouldReloadUsageLimits = Date.now() - this.cache.usageLimitsLastUpdate.getTime() > 120000;
      let usageLimits = this.cache.usageLimits;
      if (shouldReloadUsageLimits) {
        const fetchedLimits = await this.apiClient.fetchUsageLimits();
        if (fetchedLimits) {
          usageLimits = fetchedLimits;
          this.cache.usageLimits = usageLimits;
          this.cache.usageLimitsLastUpdate = new Date();
        }
      }

      if (records.length === 0) {
        const error = 'No usage records found. Make sure Claude Code is running.';
        console.warn('[Extension]', error);
        this.statusBar.updateUsageData(null, error, usageLimits);
        this.webviewProvider.updateData(null, null, null, null, [], [], [], error, dataDirectory, undefined, usageLimits);
        return;
      }
      console.log('[Extension] Processing', records.length, 'records');

      // Calculate usage data
      const sessionData = ClaudeDataLoader.getCurrentSessionData(records);
      const todayData = ClaudeDataLoader.getTodayData(records);
      const monthData = ClaudeDataLoader.getThisMonthData(records);
      const allTimeData = ClaudeDataLoader.getAllTimeData(records);
      const dailyDataForMonth = ClaudeDataLoader.getDailyDataForMonth(records);
      const dailyDataForAllTime = ClaudeDataLoader.getDailyDataForAllTime(records);
      const hourlyDataForToday = ClaudeDataLoader.getHourlyDataForToday(records);

      // Update UI
      console.log('[Extension] Updating UI with data. Today cost:', todayData?.totalCost || 0);
      this.statusBar.updateUsageData(todayData, undefined, usageLimits);
      this.webviewProvider.updateData(sessionData, todayData, monthData, allTimeData, dailyDataForMonth, dailyDataForAllTime, hourlyDataForToday, undefined, dataDirectory, records, usageLimits);
      console.log('[Extension] refreshData completed successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[Extension] Error refreshing Claude Code usage data:', errorMessage);
      console.error('[Extension] Full error:', error);

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