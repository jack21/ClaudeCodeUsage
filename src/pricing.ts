// Claude Price calculation by model

import { ModelPricing } from "./types";

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

const MILL = 1_000_000;

// Official Price Info (State 2025-11-28)
// https://platform.claude.com/docs/en/about-claude/models/overview
// https://platform.claude.com/docs/en/about-claude/pricing
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude Sonnet 4
  "claude-sonnet-4-20250514": {
    input_cost_per_token: 3 / MILL, // $3.00 / 1M tokens
    output_cost_per_token: 15 / MILL, // $15.00 / 1M tokens
    cache_creation_input_token_cost: 3.75 / MILL, // $3.75 / 1M tokens (5min caching)
    cache_read_input_token_cost: 0.3 / MILL, // $0.30 / 1M tokens
  },

  // Claude Opus 4
  "claude-opus-4-20250514": {
    input_cost_per_token: 15 / MILL, // $15.00 / 1M tokens
    output_cost_per_token: 75 / MILL, // $75.00 / 1M tokens
    cache_creation_input_token_cost: 18.75 / MILL, // $18.75 / 1M tokens (5min caching)
    cache_read_input_token_cost: 1.5 / MILL, // $1.50 / 1M tokens
  },

  // Claude Opus 4.1 (2025-08-05)
  "claude-opus-4-1-20250805": {
    input_cost_per_token: 15 / MILL, // $15.00 / 1M tokens
    output_cost_per_token: 75 / MILL, // $75.00 / 1M tokens
    cache_creation_input_token_cost: 18.75 / MILL, // $18.75 / 1M tokens (5min caching)
    cache_read_input_token_cost: 1.5 / MILL, // $1.50 / 1M tokens
  },

  // Claude Opus 4.1 (alias)
  "claude-opus-4-1": {
    input_cost_per_token: 15 / MILL, // $15.00 / 1M tokens
    output_cost_per_token: 75 / MILL, // $75.00 / 1M tokens
    cache_creation_input_token_cost: 18.75 / MILL, // $18.75 / 1M tokens (5min caching)
    cache_read_input_token_cost: 1.5 / MILL, // $1.50 / 1M tokens
  },

  // Claude Opus 4.5 (2025-11 v01)
  "claude-opus-4-5-20251101": {
    input_cost_per_token: 5 / MILL, // $5.00 / 1M tokens
    output_cost_per_token: 25 / MILL, // $25.00 / 1M tokens
    cache_creation_input_token_cost: 6 / MILL, // $6 / 1M tokens (5min caching)
    cache_read_input_token_cost: 0.5 / MILL, // $0.50 / 1M tokens
  },

  // Claude Opus 4.5 (alias)
  "claude-opus-4-5": {
    input_cost_per_token: 5 / MILL, // $5.00 / 1M tokens
    output_cost_per_token: 25 / MILL, // $25.00 / 1M tokens
    cache_creation_input_token_cost: 6 / MILL, // $6 / 1M tokens (5min caching)
    cache_read_input_token_cost: 0.5 / MILL, // $0.50 / 1M tokens
  },

  // Claude Sonnet 3.5 (2024-10-22)
  "claude-3-5-sonnet-20241022": {
    input_cost_per_token: 3 / MILL, // $3.00 / 1M tokens
    output_cost_per_token: 15 / MILL, // $15.00 / 1M tokens
    cache_creation_input_token_cost: 3.75 / MILL, // $3.75 / 1M tokens (5min caching)
    cache_read_input_token_cost: 0.3 / MILL, // $0.30 / 1M tokens
  },

  // Claude Haiku 3.5 (Not used anymore)
  "claude-3-5-haiku-20241022": {
    input_cost_per_token: 0.8 / MILL, // $0.8 / 1M tokens
    output_cost_per_token: 4 / MILL, // $4.00 / 1M tokens
    cache_creation_input_token_cost: 1.6 / MILL, // $1.6 / 1M tokens
    cache_read_input_token_cost: 0.08 / MILL, // $0.08 / 1M tokens
  },

  // Claude Haiku 4.5 (2025-10 v01)
  "claude-haiku-4-5-20251001": {
    input_cost_per_token: 1 / MILL, // $1.00 / 1M tokens
    output_cost_per_token: 5 / MILL, // $5.00 / 1M tokens
    cache_creation_input_token_cost: 1.25 / MILL, // $1.25 / 1M tokens
    cache_read_input_token_cost: 0.1 / MILL, // $0.10 / 1M tokens
  },
};

/**
 * Get pricing information for a model
 * @param modelName Model name
 * @returns Pricing information, or null if not found
 */
export function getModelPricing(
  modelName: string | undefined,
): ModelPricing | null {
  if (!modelName) {
    return null;
  }

  // Direct match
  if (MODEL_PRICING[modelName]) {
    return MODEL_PRICING[modelName];
  }

  // Try different variation matches (similar to ccusage logic)
  const variations = [
    modelName,
    `anthropic/${modelName}`,
    `claude-3-5-${modelName}`,
    `claude-3-${modelName}`,
    `claude-${modelName}`,
  ];

  for (const variation of variations) {
    if (MODEL_PRICING[variation]) {
      return MODEL_PRICING[variation];
    }
  }

  // If unknown model, use Sonnet 4 pricing as default
  console.warn(
    `Unknown model: ${modelName}, using Sonnet 4 pricing as fallback`,
  );
  return MODEL_PRICING["claude-sonnet-4-20250514"];
}

/**
 * Calculate cost from given token usage and pricing
 * @param tokens Token usage
 * @param pricing Pricing information
 * @returns Total cost (USD)
 */
export function calculateCostFromPricing(
  tokens: TokenUsage,
  pricing: ModelPricing,
): number {
  let cost = 0;

  // Input tokens cost
  if (pricing.input_cost_per_token != null) {
    cost += tokens.input_tokens * pricing.input_cost_per_token;
  }

  // Output tokens cost
  if (pricing.output_cost_per_token != null) {
    cost += tokens.output_tokens * pricing.output_cost_per_token;
  }

  // Cache creation tokens cost
  if (
    tokens.cache_creation_input_tokens != null &&
    pricing.cache_creation_input_token_cost != null
  ) {
    cost +=
      tokens.cache_creation_input_tokens *
      pricing.cache_creation_input_token_cost;
  }

  // Cache read tokens cost
  if (
    tokens.cache_read_input_tokens != null &&
    pricing.cache_read_input_token_cost != null
  ) {
    cost +=
      tokens.cache_read_input_tokens * pricing.cache_read_input_token_cost;
  }

  return cost;
}

/**
 * Calculate total cost of model usage
 * @param tokens Token usage
 * @param modelName Model name
 * @returns Total cost (USD), returns 0 if pricing not found
 */
export function calculateCostFromTokens(
  tokens: TokenUsage,
  modelName: string | undefined,
): number {
  const pricing = getModelPricing(modelName);

  if (!pricing) {
    return 0;
  }

  return calculateCostFromPricing(tokens, pricing);
}
