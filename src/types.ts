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
}

export interface UsageData {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalCost: number;
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

export interface ExtensionConfig {
  refreshInterval: number;
  dataDirectory: string;
  language: string;
  decimalPlaces: number;
}

export interface ModelPricing {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_creation_input_token_cost?: number;
  cache_read_input_token_cost?: number;
}

export type SupportedLanguage = 'en' | "de-DE" | 'zh-TW' | 'zh-CN' | 'ja' | 'ko';

// Claude API Usage Limits
export interface UsageLimit {
  utilization: number;  // percentage (0-100)
  resets_at: string;    // ISO timestamp
}

export interface ClaudeApiUsageResponse {
  five_hour?: UsageLimit;
  seven_day?: UsageLimit;
  seven_day_sonnet?: UsageLimit;
  seven_day_opus?: UsageLimit;
}

export interface ClaudeCredentials {
  claudeAiOauth: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;  // Unix timestamp in ms
    scopes: string[];
    subscriptionType: string | null;
    rateLimitTier: string | null;
  };
  organizationUuid: string;
}