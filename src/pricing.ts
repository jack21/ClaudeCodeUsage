// Claude 模型定價計算
// 基於 Anthropic 官方定價：https://docs.anthropic.com/en/docs/about-claude/pricing

import { ModelPricing } from './types';

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// 官方定價資料 (截至 2025-08-10)
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude Sonnet 4
  'claude-sonnet-4-20250514': {
    input_cost_per_token: 0.000003,           // $3.00 / 1M tokens
    output_cost_per_token: 0.000015,          // $15.00 / 1M tokens
    cache_creation_input_token_cost: 0.00000375, // $3.75 / 1M tokens (5分鐘快取)
    cache_read_input_token_cost: 0.0000003    // $0.30 / 1M tokens
  },
  
  // Claude Opus 4
  'claude-opus-4-20250514': {
    input_cost_per_token: 0.000015,           // $15.00 / 1M tokens
    output_cost_per_token: 0.000075,          // $75.00 / 1M tokens
    cache_creation_input_token_cost: 0.00001875, // $18.75 / 1M tokens (5分鐘快取)
    cache_read_input_token_cost: 0.0000015    // $1.50 / 1M tokens
  },

  // Claude Opus 4.1 (2025-08-05 版本)
  'claude-opus-4-1-20250805': {
    input_cost_per_token: 0.000015,           // $15.00 / 1M tokens
    output_cost_per_token: 0.000075,          // $75.00 / 1M tokens
    cache_creation_input_token_cost: 0.00001875, // $18.75 / 1M tokens (5分鐘快取)
    cache_read_input_token_cost: 0.0000015    // $1.50 / 1M tokens
  },
  
  // Claude Opus 4.1 (別名支援)
  'claude-opus-4-1': {
    input_cost_per_token: 0.000015,           // $15.00 / 1M tokens
    output_cost_per_token: 0.000075,          // $75.00 / 1M tokens
    cache_creation_input_token_cost: 0.00001875, // $18.75 / 1M tokens (5分鐘快取)
    cache_read_input_token_cost: 0.0000015    // $1.50 / 1M tokens
  },

  // Claude Sonnet 3.5 (向後相容)
  'claude-3-5-sonnet-20241022': {
    input_cost_per_token: 0.000003,
    output_cost_per_token: 0.000015,
    cache_creation_input_token_cost: 0.00000375,
    cache_read_input_token_cost: 0.0000003
  },

  // Claude Haiku 3.5 (向後相容)
  'claude-3-5-haiku-20241022': {
    input_cost_per_token: 0.000001,           // $1.00 / 1M tokens
    output_cost_per_token: 0.000005,          // $5.00 / 1M tokens
    cache_creation_input_token_cost: 0.00000125, // $1.25 / 1M tokens
    cache_read_input_token_cost: 0.0000001    // $0.10 / 1M tokens
  }
};

/**
 * 獲取模型的定價資訊
 * @param modelName 模型名稱
 * @returns 定價資訊，如果找不到則返回 null
 */
export function getModelPricing(modelName: string | undefined): ModelPricing | null {
  if (!modelName) {
    return null;
  }

  // 直接匹配
  if (MODEL_PRICING[modelName]) {
    return MODEL_PRICING[modelName];
  }

  // 嘗試不同的變體匹配（類似 ccusage 的邏輯）
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

  // 如果是未知模型，使用 Sonnet 4 的定價作為預設值
  console.warn(`Unknown model: ${modelName}, using Sonnet 4 pricing as fallback`);
  return MODEL_PRICING['claude-sonnet-4-20250514'];
}

/**
 * 計算給定 token 使用量和定價的成本
 * @param tokens token 使用量
 * @param pricing 定價資訊
 * @returns 總成本 (USD)
 */
export function calculateCostFromPricing(tokens: TokenUsage, pricing: ModelPricing): number {
  let cost = 0;

  // 輸入 tokens 成本
  if (pricing.input_cost_per_token != null) {
    cost += tokens.input_tokens * pricing.input_cost_per_token;
  }

  // 輸出 tokens 成本
  if (pricing.output_cost_per_token != null) {
    cost += tokens.output_tokens * pricing.output_cost_per_token;
  }

  // 快取建立 tokens 成本
  if (tokens.cache_creation_input_tokens != null && pricing.cache_creation_input_token_cost != null) {
    cost += tokens.cache_creation_input_tokens * pricing.cache_creation_input_token_cost;
  }

  // 快取讀取 tokens 成本
  if (tokens.cache_read_input_tokens != null && pricing.cache_read_input_token_cost != null) {
    cost += tokens.cache_read_input_tokens * pricing.cache_read_input_token_cost;
  }

  return cost;
}

/**
 * 計算模型使用的總成本
 * @param tokens token 使用量
 * @param modelName 模型名稱
 * @returns 總成本 (USD)，如果找不到定價則返回 0
 */
export function calculateCostFromTokens(tokens: TokenUsage, modelName: string | undefined): number {
  const pricing = getModelPricing(modelName);
  
  if (!pricing) {
    return 0;
  }
  
  return calculateCostFromPricing(tokens, pricing);
}