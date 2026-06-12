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
  // Human-readable conversation title (what `claude --resume` shows),
  // harvested from `custom-title` / `ai-title` / legacy `summary` log lines.
  _sessionTitle?: string;
  // Encoded project directory the session file lives in (where the session
  // was started), e.g. "d--Jiaming-My-Proj". Stable per session, unlike the
  // per-record cwd which wanders as work moves between folders.
  _projectDirEncoded?: string;
  // Synthetic marker record for one genuine user prompt (zero usage).
  // messageCount counts these, so "Messages" means what users typed.
  _isUserPrompt?: boolean;
  // --- Sub-agent attribution (set when the source file sits under a
  // `subagents/` directory; see V2.1-WORKFLOW-SPEC §2) ---
  // Workflow run id ("wf_…") when the file sits under subagents/workflows/.
  _workflowId?: string;
  // Sub-agent log file basename without extension, e.g. "agent-a1b2c3".
  _agentId?: string;
  // From the sibling agent-*.meta.json: "workflow-subagent", "Explore",
  // "general-purpose", … — "unknown" when the meta file is missing/bad.
  _agentType?: string;
  // Human-readable workflow name, derived at load time from the session's
  // workflows/scripts/<name>-wf_<id>.js file (resolved once per refresh).
  _workflowName?: string;
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
  // Conversation title (from the session's summary line), when available.
  title?: string;
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

// One Claude Code dynamic-workflow run (trigger word "ultracode"): tens to
// hundreds of sub-agents fanned out under a single wf_<id>, each with its own
// usage log. Aggregated across all of the run's agent files.
export interface WorkflowUsage {
  workflowId: string;          // "wf_fcfc35cc-5d5"
  name: string;                // derived human name, or the id when unknown
  sessionId: string;           // parent session
  projectPath: string;
  projectName: string;
  startTime: Date;             // min record timestamp across agents
  endTime: Date;               // max record timestamp
  agentCount: number;
  data: UsageData;             // aggregated across all agent files
  agents: { agentId: string; data: UsageData; startTime: Date; endTime: Date }[];
}

// Per-git-branch usage aggregate.
export interface BranchUsage {
  branch: string;
  projectName: string;
  projectPath: string;
  sessionCount: number;
  lastSeen: Date;
  data: UsageData;
}

// OAuth credentials written by Claude Code at ~/.claude/.credentials.json.
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