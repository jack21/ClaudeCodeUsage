import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ClaudeDataLoader } from './dataLoader';
import { StatusBarManager } from './statusBar';
import { UsageWebviewProvider } from './webview';
import { I18n } from './i18n';
import { fetchLatestPricing } from './pricing';
import { ClaudeApiClient } from './claudeApiClient';
import { getUsageAdvice } from './advisor';
import { buildAdviceSummary } from './adviceSummary';
import { getDemoBody } from './adviceDemoSample';
import { ClaudeApiUsageResponse, ContentAnalysis, ExtensionConfig } from './types';

export class ClaudeCodeUsageExtension {
  private statusBar: StatusBarManager;
  private webviewProvider: UsageWebviewProvider;
  private apiClient: ClaudeApiClient;
  private refreshTimer: NodeJS.Timeout | undefined;
  private fileWatcher: fs.FSWatcher | undefined;
  private watchDebounceTimer: NodeJS.Timeout | undefined;
  private watchedDir: string | null = null;
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

  private outputChannel: vscode.OutputChannel;
  // Re-entrancy guard (PR #20 by @nickearnshaw). The auto-refresh timer and
  // file watcher can both fire while a slow reload is still in flight. Without
  // this, reloads pile up and keep re-asserting the "Loading…" spinner.
  private isRefreshing: boolean = false;
  // Coalesce: a trigger that arrives mid-load sets this so we run exactly one
  // more refresh after the current one finishes, instead of dropping the event
  // (which starved updates during rapid ultracode/sub-agent writes).
  private pendingRefresh: boolean = false;
  // Epoch ms of the last observed .jsonl change. Drives activity-aware
  // refresh cadence: while Claude Code is actively writing we refresh faster
  // (~15 s, quota cache 20 s); when idle we fall back to the user's interval.
  private lastActivityAt: number = 0;
  // Generation token for the self-rescheduling refresh timer. Bumped each time
  // startAutoRefresh runs so any older timer chain (e.g. left mid-flight by a
  // config change) stops instead of running concurrently with the new one.
  private refreshGen: number = 0;
  // One-shot cold-start retry for the quota fetch: when a window opens on a
  // flaky network and the very first /usage fetch fails, try once more shortly
  // after so the indicator appears without waiting for the next regular tick.
  private quotaColdRetryDone: boolean = false;

  constructor(private context: vscode.ExtensionContext) {
    console.log('Claude Code Usage Extension: Constructor called');
    this.outputChannel = vscode.window.createOutputChannel('Claude Code Usage');
    context.subscriptions.push(this.outputChannel);
    this.statusBar = new StatusBarManager();
    this.webviewProvider = new UsageWebviewProvider(context);
    this.apiClient = new ClaudeApiClient(this.outputChannel);

    this.setupCommands();
    this.loadConfiguration();
    this.startAutoRefresh();
    this.refreshData().then(() => this.startFileWatching());
    console.log('Claude Code Usage Extension: Initialization complete');
  }

  private setupCommands(): void {
    const commands = [
      vscode.commands.registerCommand('claudeCodeUsage.refresh', () => {
        // Manual refresh always updates the dashboard even when
        // pauseDashboardRefresh is on.
        this.refreshData(true);
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
      }),
      vscode.commands.registerCommand('claudeCodeUsage.showLogs', () => {
        this.outputChannel.show();
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

  private async getAdvice(): Promise<void> {
    const config = this.getConfiguration();
    // The subscription backend needs no API key (it reuses the Claude Code
    // OAuth session); only the 'api' backend requires a configured key.
    const needsKey =
      config.adviceBackend === 'api' && (!config.adviceApiKey || config.adviceApiKey.trim() === '');
    if (needsKey) {
      const picked = await vscode.window.showWarningMessage(
        I18n.t.popup.adviceNeedsKey,
        I18n.t.popup.settings,
        I18n.t.popup.adviceDemoButton
      );
      if (picked === I18n.t.popup.settings) {
        vscode.commands.executeCommand('claudeCodeUsage.openSettings');
      } else if (picked === I18n.t.popup.adviceDemoButton) {
        await this.openAdviceDemo();
      }
      return;
    }

    const records = this.cache.records;
    const analysis = this.cache.contentAnalysis;
    if (!records || records.length === 0 || !analysis) {
      vscode.window.showWarningMessage(I18n.t.popup.noDataMessage);
      return;
    }

    // Let the user scope the advice to everything, or to one project.
    const projects = ClaudeDataLoader.getProjectBreakdown(records);
    const items: (vscode.QuickPickItem & { scope: string })[] = [
      { label: I18n.t.popup.adviceScopeOverall, scope: 'overall' },
      ...projects.map((p) => ({ label: p.groupName, description: p.groupPath, scope: p.groupPath }))
    ];
    const picked = await vscode.window.showQuickPick(items, { placeHolder: I18n.t.popup.adviceScopePrompt });
    if (!picked) {
      return;
    }

    const summary = buildAdviceSummary(records, analysis, picked.scope, picked.label);

    await this.runAdviceRequest(config, picked.scope, picked.label, summary);
  }

  private async openAdviceDemo(): Promise<void> {
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    const stamp =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const uri = vscode.Uri.parse(`untitled:claude-advice-DEMO-${stamp}.md`);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    const lang = I18n.getCurrentLanguage();
    const banner = I18n.t.popup.adviceDemoNotice;
    const body = getDemoBody(lang);
    const content = `${banner}\n\n---\n\n${body}`;
    await editor.edit((eb) => eb.insert(new vscode.Position(0, 0), content));
  }

  private async runAdviceRequest(
    config: ExtensionConfig,
    scope: string,
    label: string,
    summary: string
  ): Promise<void> {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: I18n.t.popup.adviceGenerating },
      async () => {
        try {
          const advice = await getUsageAdvice({
            backend: config.adviceBackend,
            apiFormat: config.adviceApiFormat,
            subscriptionModel: config.adviceSubscriptionModel,
            getSubscriptionToken: () => this.apiClient.getAccessToken(),
            apiKey: config.adviceApiKey,
            apiUrl: config.adviceApiUrl,
            model: config.adviceModel,
            reasoningEffort: config.adviceReasoningEffort,
            userContext: config.adviceUserContext,
            language: I18n.getLanguageName(),
            summary
          });

          // Give the document a distinguishable name like
          // claude-advice-<scope>-YYYY-MM-DD_HHmm.md so different runs are easy
          // to tell apart in the tab strip.
          const now = new Date();
          const pad = (n: number): string => String(n).padStart(2, '0');
          const stamp =
            `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
            `_${pad(now.getHours())}${pad(now.getMinutes())}`;
          const safeScope =
            scope === 'overall'
              ? 'overall'
              : (label || 'project').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 30) || 'project';
          const uri = vscode.Uri.parse(`untitled:claude-advice-${safeScope}-${stamp}.md`);
          const doc = await vscode.workspace.openTextDocument(uri);
          const editor = await vscode.window.showTextDocument(doc);
          await editor.edit((eb) => eb.insert(new vscode.Position(0, 0), advice));
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
    I18n.setTimezone(config.timezone);
    this.statusBar.setVisibility(config.showCost, config.showContext);

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
      timezone: config.get('timezone', ''),
      showCost: config.get('showCost', true),
      showContext: config.get('showContext', true),
      usageLimitTracking: config.get('usageLimitTracking', true),
      // apiKey is the gate for the advice feature: ONLY read the new dotted
      // key. We deliberately do NOT fall back to the pre-2.0 flat
      // `adviceApiKey` here — otherwise users who clear the new key in
      // Settings would silently keep the feature enabled via the stale flat
      // key, with no way to enter demo mode. Other config (URL / model /
      // effort) still falls back, since they only affect *how* requests are
      // sent, not whether they are sent.
      adviceApiKey: config.get<string>('advice.apiKey', ''),
      adviceApiUrl:
        config.get<string>('advice.apiUrl') ||
        config.get<string>('adviceApiUrl', 'https://api.deepseek.com/chat/completions'),
      adviceModel: config.get<string>('advice.model') || config.get<string>('adviceModel', 'deepseek-v4-pro'),
      adviceReasoningEffort:
        config.get<string>('advice.reasoningEffort') ?? config.get<string>('adviceReasoningEffort', 'max'),
      adviceUserContext: config.get<string>('advice.userContext', ''),
      adviceBackend: config.get<'subscription' | 'api'>('advice.backend', 'subscription'),
      adviceApiFormat: config.get<'anthropic' | 'openai'>('advice.apiFormat', 'anthropic'),
      adviceSubscriptionModel: config.get<string>('advice.subscriptionModel', 'claude-haiku-4-5'),
      enableContentAnalysis: config.get('enableContentAnalysis', true),
      projectGroupingMode: config.get('projectGroupingMode', 'git') as 'git' | 'folder' | 'flat',
      fileWatching: config.get('fileWatching', true),
      pauseDashboardRefresh: config.get('pauseDashboardRefresh', false)
    };
  }

  private onConfigurationChanged(): void {
    const config = this.getConfiguration();
    I18n.setLanguage(config.language as any);
    I18n.setDecimalPlaces(config.decimalPlaces);
    I18n.setCompactNumbers(config.compactNumbers);
    I18n.setTimezone(config.timezone);
    this.statusBar.setVisibility(config.showCost, config.showContext);

    // Restart auto-refresh with new interval
    this.startAutoRefresh();

    // Clear cache if data directory changed
    if (config.dataDirectory !== this.cache.dataDirectory) {
      this.cache.records = [];
      this.cache.lastUpdate = new Date(0);
      this.cache.dataDirectory = config.dataDirectory;
      this.stopFileWatching();
    }

    // Refresh data immediately, then (re-)attach the file watcher.
    this.refreshData().then(() => this.startFileWatching());
  }

  /**
   * Watch the Claude projects directory for new/changed jsonl lines so the
   * status bar reflects new usage within ~1.5 seconds instead of waiting for
   * the polling timer. Falls back silently if fs.watch fails (some platforms /
   * filesystems do not support recursive watching).
   */
  private async startFileWatching(): Promise<void> {
    const config = this.getConfiguration();
    if (!config.fileWatching) {
      this.stopFileWatching();
      return;
    }
    const dataDirectory = await ClaudeDataLoader.findClaudeDataDirectory(config.dataDirectory || undefined);
    if (!dataDirectory) {
      return;
    }
    const projectsDir = path.join(dataDirectory, 'projects');
    if (!fs.existsSync(projectsDir) || this.watchedDir === projectsDir) {
      return;
    }
    this.stopFileWatching();
    try {
      this.fileWatcher = fs.watch(projectsDir, { recursive: true }, (_event, filename) => {
        if (!filename || !String(filename).endsWith('.jsonl')) {
          return;
        }
        // Mark activity so the polling timer and quota cache switch to the
        // faster "active" cadence. This fires for sub-agent / workflow files
        // too, since fs.watch is recursive.
        this.lastActivityAt = Date.now();
        // Debounce: Claude Code writes lines in bursts and the file mtime
        // changes for every line.
        if (this.watchDebounceTimer) {
          clearTimeout(this.watchDebounceTimer);
        }
        this.watchDebounceTimer = setTimeout(() => {
          this.refreshData();
        }, 1500);
      });
      this.watchedDir = projectsDir;
    } catch {
      // Recursive watching unsupported — the polling timer is enough.
    }
  }

  private stopFileWatching(): void {
    if (this.watchDebounceTimer) {
      clearTimeout(this.watchDebounceTimer);
      this.watchDebounceTimer = undefined;
    }
    if (this.fileWatcher) {
      try {
        this.fileWatcher.close();
      } catch {
        // Already closed.
      }
      this.fileWatcher = undefined;
    }
    this.watchedDir = null;
  }

  /** True when Claude Code has written a log line in the last 60 s. */
  private isActive(): boolean {
    return Date.now() - this.lastActivityAt < 60000;
  }

  private startAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    // Self-rescheduling timer with an activity-aware interval: while Claude
    // Code is actively writing logs we tick every ~15 s (matching the user's
    // expectation that ultracode / high-consumption runs update promptly);
    // when idle we use the user's configured interval (min 30 s). fs.watch
    // already covers near-real-time status-bar cost updates during activity —
    // this floor guarantees the quota also refreshes during sustained writes
    // where the debounce never settles.
    const gen = ++this.refreshGen;
    const tick = (): void => {
      if (gen !== this.refreshGen) {
        return; // superseded by a newer startAutoRefresh — stop this chain
      }
      const base = Math.max(this.getConfiguration().refreshInterval * 1000, 30000);
      // ~8 s while active: high-consumption models (Fable 5) move the numbers
      // fast enough that 15 s reads as laggy.
      const intervalMs = this.isActive() ? Math.min(base, 8000) : base;
      this.refreshTimer = setTimeout(() => {
        this.refreshData().finally(() => {
          if (gen === this.refreshGen) {
            tick();
          }
        });
      }, intervalMs);
    };
    tick();
  }

  /** Fetch real usage limits via OAuth, cached for 2 minutes. */
  private async maybeFetchUsageLimits(config: ExtensionConfig): Promise<ClaudeApiUsageResponse | null> {
    if (!config.usageLimitTracking) {
      return null;
    }
    const age = Date.now() - this.cache.usageLimitsLastUpdate.getTime();
    // Activity-aware cache: 20 s while Claude Code is actively writing (so the
    // quota keeps pace during high-consumption ultracode runs), 120 s when
    // idle (avoids hammering /usage on every file-watch tick). The /usage
    // client has its own 429 cool-down, so 20 s is safe.
    // Quota changes slowly (a coarse %), and /usage is an undocumented
    // endpoint that 429s if hit too often. Keep this well above the local
    // refresh cadence: 60 s while active, 120 s idle. Local cost still updates
    // every ~8 s via the fs watcher — only the quota number is throttled.
    const ttl = this.isActive() ? 60000 : 120000;
    // Bypass the cache when a cached window has already reset — otherwise the
    // status bar would show the rolled-forward 0% estimate for up to a full
    // TTL before the real new-window value arrives.
    if (this.cache.usageLimits && age < ttl && !this.hasExpiredWindow(this.cache.usageLimits)) {
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

  /** True if any usage window's reset time has already passed (so the cached
   * utilisation is stale and a refetch is warranted). */
  private hasExpiredWindow(u: ClaudeApiUsageResponse): boolean {
    const now = Date.now();
    const expired = (w?: { resets_at: string }): boolean => {
      if (!w) {
        return false;
      }
      const t = Date.parse(w.resets_at);
      return !isNaN(t) && t <= now;
    };
    return expired(u.five_hour) || expired(u.seven_day) || expired(u.seven_day_opus);
  }

  private async refreshData(manualTrigger: boolean = false): Promise<void> {
    if (this.isRefreshing) {
      // Coalesce: remember that another refresh was requested and run exactly
      // one more after the current finishes (see finally). Dropping the event
      // outright starved updates during rapid ultracode / sub-agent writes.
      this.pendingRefresh = true;
      return;
    }
    this.isRefreshing = true;
    try {
      const config = this.getConfiguration();
      // When the user has paused dashboard refresh, auto-triggers (timer +
      // fs.watch) skip the webview update entirely; the status bar still
      // refreshes so today's cost / quota stay live. Manual command always
      // refreshes everything so the user can force-update on demand.
      const updateWebview = manualTrigger || !config.pauseDashboardRefresh;

      // Quota is account-level, decoupled from local data. Fire it without
      // awaiting so a slow/cold OAuth fetch (curl can take seconds, or fail
      // outright on a fresh window's flaky network) never delays the local
      // cost figures — the cause of "usage not showing the first time I open
      // VS Code". On a cold start with no quota yet, do ONE gentle retry after
      // ~8 s; beyond that the regular ticks take over. We deliberately do not
      // retry-storm: repeated /usage hits are what trigger the 429 cool-down.
      this.maybeFetchUsageLimits(config).then((limits) => {
        this.statusBar.updateQuota(limits);
        this.webviewProvider.updateQuota(limits);
        if (!limits && !this.cache.usageLimits && !this.quotaColdRetryDone) {
          this.quotaColdRetryDone = true;
          setTimeout(() => {
            this.maybeFetchUsageLimits(this.getConfiguration()).then((retry) => {
              if (retry) {
                this.statusBar.updateQuota(retry);
                this.webviewProvider.updateQuota(retry);
              }
            });
          }, 8000);
        }
      });

      // Find Claude data directory
      const dataDirectory = await ClaudeDataLoader.findClaudeDataDirectory(
        config.dataDirectory || undefined
      );

      if (!dataDirectory) {
        const error = 'Claude data directory not found. Please check your configuration.';
        this.statusBar.updateUsageData(null, null, error);
        this.statusBar.updateContext(null);
        if (updateWebview) {
          this.webviewProvider.updateData(null, null, null, null, [], [], [], error, null);
        }
        return;
      }

      // Skip the heavy recompute when nothing has changed since the last load —
      // this avoids pointless work (and CPU spikes) while you are not running code.
      const latestMtime = await ClaudeDataLoader.getLatestModifiedTime(dataDirectory);
      const dirChanged = this.cache.dataDirectory !== dataDirectory;
      const needFullRefresh =
        dirChanged || this.cache.records.length === 0 || latestMtime > this.cache.lastUpdate.getTime();

      if (!needFullRefresh) {
        // Idle: logs unchanged. Quota was already refreshed above. Still
        // recompute the context indicator from cache so its 5-hour recency
        // guard can hide it once the session goes stale.
        this.statusBar.updateContext(
          ClaudeDataLoader.getCurrentContextInfo(
            this.cache.records,
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
          )
        );
        return;
      }

      // Only show the full-screen spinner on the very first load (cold cache,
      // nothing on screen yet). Background refreshes keep existing dashboard
      // visible and swap in fresh data when ready — avoiding panel flicker
      // on every file-watch tick during active use. (PR #20, @nickearnshaw)
      if (this.cache.records.length === 0) {
        this.statusBar.setLoading(true);
        if (updateWebview) {
          this.webviewProvider.setLoading(true);
        }
      }

      const loaded = await ClaudeDataLoader.loadUsageRecords(dataDirectory, {
        analyzeContent: config.enableContentAnalysis,
        log: (line) =>
          this.outputChannel.appendLine(
            `[${new Date().toLocaleTimeString(undefined, { hour12: false })}] ${line}`
          )
      });
      const records = loaded.records;
      const contentAnalysis = loaded.contentAnalysis;
      this.cache.records = records;
      this.cache.contentAnalysis = contentAnalysis;
      this.cache.lastUpdate = new Date();
      this.cache.dataDirectory = dataDirectory;

      if (records.length === 0) {
        const error = 'No usage records found. Make sure Claude Code is running.';
        this.statusBar.updateUsageData(null, null, error);
        this.statusBar.updateContext(null);
        if (updateWebview) {
          this.webviewProvider.updateData(null, null, null, null, [], [], [], error, dataDirectory);
        }
        return;
      }

      // Calculate usage data
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      // "Current session" (per-workspace) is still computed for the webview.
      const sessionData = ClaudeDataLoader.getCurrentSessionData(records, workspacePath);
      const todayData = ClaudeDataLoader.getTodayData(records);
      // Status-bar secondary number: today's cost for the current workspace.
      const workspaceTodayData = workspacePath
        ? ClaudeDataLoader.getTodayData(ClaudeDataLoader.filterByWorkspace(records, workspacePath))
        : null;
      const monthData = ClaudeDataLoader.getThisMonthData(records);
      const allTimeData = ClaudeDataLoader.getAllTimeData(records);
      const dailyDataForMonth = ClaudeDataLoader.getDailyDataForMonth(records);
      const dailyDataForAllTime = ClaudeDataLoader.getDailyDataForAllTime(records);
      const hourlyDataForToday = ClaudeDataLoader.getHourlyDataForToday(records);
      const sessionBreakdown = ClaudeDataLoader.getSessionBreakdown(records);
      const projectBreakdown = ClaudeDataLoader.getProjectBreakdown(records, undefined, config.projectGroupingMode);
      const branchBreakdown = ClaudeDataLoader.getBranchBreakdown(records);
      const workflowBreakdown = ClaudeDataLoader.getWorkflowBreakdown(records);

      // Update UI. Quota is pushed asynchronously by the fire-and-forget fetch
      // above; passing undefined leaves the quota item untouched here.
      this.statusBar.updateUsageData(todayData, workspaceTodayData, undefined, undefined);
      this.statusBar.updateContext(ClaudeDataLoader.getCurrentContextInfo(records, workspacePath));
      if (updateWebview) {
        this.webviewProvider.updateData(sessionData, todayData, monthData, allTimeData, dailyDataForMonth, dailyDataForAllTime, hourlyDataForToday, undefined, dataDirectory, records, sessionBreakdown, projectBreakdown, contentAnalysis, branchBreakdown, workflowBreakdown);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error refreshing Claude Code usage data:', error);

      this.statusBar.updateUsageData(null, null, errorMessage);
      this.statusBar.updateContext(null);
      if (manualTrigger || !this.getConfiguration().pauseDashboardRefresh) {
        this.webviewProvider.updateData(null, null, null, null, [], [], [], errorMessage, null);
      }
    } finally {
      this.isRefreshing = false;
      // If triggers arrived mid-load, run one more (background) refresh to pick
      // up the changes they signalled. The pendingRefresh flag collapses any
      // number of dropped triggers into a single follow-up.
      if (this.pendingRefresh) {
        this.pendingRefresh = false;
        setTimeout(() => this.refreshData(), 0);
      }
    }
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this.stopFileWatching();
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
