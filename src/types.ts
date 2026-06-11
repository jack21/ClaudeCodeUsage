export interface ClaudeUsageRecord {
  timestamp: string;
  version?: string;
  message: {
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    model?: string;
    id?: string;
  };
  costUSD?: number;
  requestId?: string;
  isApiErrorMessage?: boolean;
  // --- Fields populated by the loader from each record's source .jsonl file ---
  // (a single .jsonl file == a single Claude Code conversation/session)
  _sessionId?: string;
  _projectName?: string;
  _projectPath?: string;
  _gitBranch?: string;
}

export interface UsageData {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalCost: number;
  // Cost split by token type (the four sum to totalCost).
  costBreakdown: {
    input: number;
    output: number;
    cacheWrite: number;
    cacheRead: number;
  };
  messageCount: number;
  modelBreakdown: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    cost: number;
    count: number;
  }>;
}

export interface SessionData extends UsageData {
  sessionStart: Date;
  sessionEnd: Date;
}

// Per-conversation breakdown: one entry per Claude Code session (.jsonl file).
export interface SessionUsage {
  sessionId: string;
  projectName: string;
  projectPath: string;
  startTime: Date;
  endTime: Date;
  data: UsageData;
  // Largest context window observed in the session
  // (input + cache read + cache creation tokens of a single request).
  peakContextTokens: number;
}

// Per-project breakdown: usage aggregated across every session of a project.
export interface ProjectUsage {
  projectName: string;
  projectPath: string;
  sessionCount: number;
  firstSeen: Date;
  lastSeen: Date;
  data: UsageData;
}

// A group of projects. Projects are grouped by their enclosing git repository
// when one exists, otherwise by their top-level project folder. Projects whose
// paths differ only in case are merged into a single child.
export interface ProjectGroup {
  groupName: string;
  groupPath: string;
  isGitRepo: boolean;
  projectCount: number;
  sessionCount: number;
  firstSeen: Date;
  lastSeen: Date;
  data: UsageData;
  children: ProjectUsage[];
}

// One slice of the content-consumption analysis (a category, or a single tool).
export interface ContentSlice {
  key: string;
  estimatedTokens: number;
  charCount: number;
  count: number;
}

// Estimated breakdown of which conversation content consumes tokens. Token
// figures are estimated from character counts, so treat them as approximate —
// the relative shares are the reliable signal.
export interface ContentAnalysis {
  categories: ContentSlice[];
  toolResultBreakdown: ContentSlice[];
  totalEstimatedTokens: number;
  // Recent user prompts (last 30 days), for the AI-advice feature. Each carries
  // its working directory so advice can be scoped to a project.
  recentPrompts: { cwd: string; text: string }[];
}

export interface ExtensionConfig {
  refreshInterval: number;
  dataDirectory: string;
  language: string;
  decimalPlaces: number;
  compactNumbers: boolean;
  // IANA timezone name (e.g. "Asia/Hong_Kong") used for date display, or ''
  // to use the system timezone. Useful for users in devcontainers or
  // sandboxes whose system zone doesn't match their actual zone.
  timezone: string;
  // Fetch real 5-hour / weekly limit utilisation via Claude Code's OAuth session.
  usageLimitTracking: boolean;
  // LLM "usage advice" feature (OpenAI-compatible endpoint, e.g. DeepSeek).
  adviceApiKey: string;
  adviceApiUrl: string;
  adviceModel: string;
  // Reasoning effort for advice models that support it ('', 'high', 'max').
  adviceReasoningEffort: string;
  // Run the (CPU-heavy) content/prompt-token analysis. When false the Content
  // tab is hidden and the analysis is skipped during refresh.
  enableContentAnalysis: boolean;
  // How the Projects tab groups working directories:
  //   - 'git'    group by enclosing git repository (default; current behaviour)
  //   - 'folder' group by the heuristic top-level project folder only
  //   - 'flat'   no grouping; every working directory is its own row
  projectGroupingMode: 'git' | 'folder' | 'flat';
  // Watch log files and refresh within ~1.5s of each new message. When false
  // the extension falls back to the interval-based refresh, which is calmer
  // but lags behind real-time.
  fileWatching: boolean;
  // Skip the dashboard webview on auto-refreshes (status bar still updates).
  // Use when the constantly-reloading dashboard interferes with reading
  // numbers while an agent is actively writing.
  pauseDashboardRefresh: boolean;
}

export interface ModelPricing {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_creation_input_token_cost?: number;
  cache_read_input_token_cost?: number;
}

export type SupportedLanguage = 'en' | "de-DE" | 'zh-TW' | 'zh-CN' | 'ja' | 'ko';

// Per-git-branch usage aggregate.
export interface BranchUsage {
  branch: string;
  projectName: string;
  projectPath: string;
  sessionCount: number;
  lastSeen: Date;
  data: UsageData;
}

// OAuth credentials stored by Claude Code at ~/.claude/.credentials.json or in
// the macOS Keychain.
export interface ClaudeCredentials {
  claudeAiOauth: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

// One limit window from api.anthropic.com/api/oauth/usage.
export interface ClaudeUsageLimit {
  utilization: number; // 0-100
  resets_at: string; // ISO timestamp
}

// Response from the OAuth usage endpoint (mirrors what /usage shows).
export interface ClaudeApiUsageResponse {
  five_hour?: ClaudeUsageLimit;
  seven_day?: ClaudeUsageLimit;
  seven_day_opus?: ClaudeUsageLimit;
}
