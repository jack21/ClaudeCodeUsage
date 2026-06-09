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

  /**
   * Build the advice prompt for a scope. Includes a usage summary, the content
   * breakdown, and a sample of the developer's actual prompts so the model can
   * critique instruction quality.
   * @param scope 'overall' or a project group path
   */
  private buildAdviceSummary(records: any[], analysis: ContentAnalysis, scope: string, scopeLabel: string): string {
    const norm = (p: string): string => (p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    const isOverall = scope === 'overall';
    const scopedRecords = isOverall
      ? records
      : records.filter((r) => norm(r._projectPath || '').startsWith(norm(scope)));
    const usage = ClaudeDataLoader.getAllTimeData(scopedRecords);
    const prompts = isOverall
      ? analysis.recentPrompts
      : analysis.recentPrompts.filter((p) => norm(p.cwd).startsWith(norm(scope)));
    const promptSample = prompts.slice(-80);

    const lines: string[] = [];
    lines.push(`Scope: ${isOverall ? 'overall (all projects)' : scopeLabel}`);
    lines.push(
      `Usage: cost $${usage.totalCost.toFixed(2)}, input ${usage.totalInputTokens}, ` +
        `output ${usage.totalOutputTokens}, cache-write ${usage.totalCacheCreationTokens}, ` +
        `cache-read ${usage.totalCacheReadTokens}, messages ${usage.messageCount}`
    );
    lines.push(`Models used: ${Object.keys(usage.modelBreakdown).join(', ') || 'n/a'}`);
    lines.push('');
    lines.push('Content token breakdown, all projects, last 30 days (estimated):');
    for (const c of analysis.categories) {
      const pct =
        analysis.totalEstimatedTokens > 0
          ? ((c.estimatedTokens / analysis.totalEstimatedTokens) * 100).toFixed(1)
          : '0';
      lines.push(`- ${c.key}: ~${c.estimatedTokens} tokens (${pct}%)`);
    }
    lines.push('');
    if (promptSample.length === 0) {
      lines.push('=== No recent user prompts captured for this scope ===');
      lines.push(
        'No prompt samples are available. Base your advice on the aggregate usage above and ' +
          'on general Claude Code best practices for writing clearer, more complete and more ' +
          'effective instructions. Also note any easy token savings the aggregates suggest.'
      );
    } else {
      lines.push(`=== Sample of ${promptSample.length} recent user prompts (review these for instruction quality) ===`);
      promptSample.forEach((p, i) => {
        lines.push(`[Prompt ${i + 1}]`);
        lines.push(p.text);
        lines.push('');
      });
      lines.push('=== End of prompts ===');
      lines.push('');
      lines.push(
        'Based primarily on the prompts above, give specific advice on how to write clearer, ' +
          'more complete and more effective instructions for Claude Code, with concrete rewrite ' +
          'examples drawn from the samples. Secondarily, note any easy token savings.'
      );
    }
    return lines.join('\n');
  }

  private async getAdvice(): Promise<void> {
    const config = this.getConfiguration();
    if (!config.adviceApiKey || config.adviceApiKey.trim() === '') {
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

    const summary = this.buildAdviceSummary(records, analysis, picked.scope, picked.label);

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
            apiKey: config.adviceApiKey,
            apiUrl: config.adviceApiUrl,
            model: config.adviceModel,
            reasoningEffort: config.adviceReasoningEffort,
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
    const tick = (): void => {
      const base = Math.max(this.getConfiguration().refreshInterval * 1000, 30000);
      const intervalMs = this.isActive() ? Math.min(base, 15000) : base;
      this.refreshTimer = setTimeout(() => {
        this.refreshData().finally(tick);
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
    const ttl = this.isActive() ? 20000 : 120000;
    if (this.cache.usageLimits && age < ttl) {
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

      // Quota is account-level, decoupled from local data. Refresh and push
      // it unconditionally, even when the workspace has no Claude history or
      // when something later fails — otherwise opening VS Code in a fresh
      // project would hide a quota indicator that ought to be account-wide.
      const usageLimits = await this.maybeFetchUsageLimits(config);
      this.statusBar.updateQuota(usageLimits);

      // Find Claude data directory
      const dataDirectory = await ClaudeDataLoader.findClaudeDataDirectory(
        config.dataDirectory || undefined
      );

      if (!dataDirectory) {
        const error = 'Claude data directory not found. Please check your configuration.';
        this.statusBar.updateUsageData(null, null, error);
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
        // Idle: logs unchanged. Quota was already refreshed above.
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
        if (updateWebview) {
          this.webviewProvider.updateData(null, null, null, null, [], [], [], error, dataDirectory);
        }
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
      const projectBreakdown = ClaudeDataLoader.getProjectBreakdown(records, undefined, config.projectGroupingMode);
      const branchBreakdown = ClaudeDataLoader.getBranchBreakdown(records);

      // Update UI — quota was already pushed above, so we pass it again only
      // to keep the success-path signature stable.
      this.statusBar.updateUsageData(todayData, sessionData, undefined, usageLimits);
      if (updateWebview) {
        this.webviewProvider.updateData(sessionData, todayData, monthData, allTimeData, dailyDataForMonth, dailyDataForAllTime, hourlyDataForToday, undefined, dataDirectory, records, sessionBreakdown, projectBreakdown, contentAnalysis, branchBreakdown);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error refreshing Claude Code usage data:', error);

      this.statusBar.updateUsageData(null, null, errorMessage);
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
