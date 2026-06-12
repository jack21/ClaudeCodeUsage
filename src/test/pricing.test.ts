// Seed test for the project's test suite (see issue #25).
//
// Approach: Node's built-in test runner (`node:test` + `node:assert`) against
// the *compiled* output — zero new runtime/dev dependencies. Tests live in
// `src/test/` so `tsc` (rootDir: src) emits them to `out/test/`, then
// `node --test out/test/` runs every `*.test.js` there. See the `test` script
// in package.json.
//
// Only pure, dependency-free modules belong here — anything importing the
// `vscode` API needs the heavier @vscode/test-electron harness instead. This
// one file is intentionally a single illustrative example; follow the same
// pattern to cover aggregation, quota-window handling, and i18n next.

import { test } from 'node:test';
import * as assert from 'node:assert/strict';

import { calculateCostFromTokens, getModelPricing } from '../pricing';

test('calculateCostFromTokens prices a known model from its per-token rates', () => {
  // Opus current tier: $5 / $25 / $6.25 / $0.50 per million in/out/write/read.
  const cost = calculateCostFromTokens(
    {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    },
    'claude-opus-4-8'
  );

  // 5 + 25 + 6.25 + 0.5 = 36.75. Use a tolerance — per-token rates are floats.
  assert.ok(Math.abs(cost - 36.75) < 1e-9, `expected ~36.75, got ${cost}`);
});

test('getModelPricing falls back to the right family for an unknown snapshot', () => {
  // An unreleased Opus snapshot isn't in the exact table; it should still
  // resolve to the current Opus tier ($5/MTok input) rather than a wrong rate.
  const pricing = getModelPricing('claude-opus-4-9-20990101');
  assert.ok(pricing, 'expected a fallback pricing object, got null');
  assert.equal(pricing!.input_cost_per_token, 5 / 1_000_000);
});
