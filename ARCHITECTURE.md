# Architecture

> A concise technical map of this extension — what it is, how data flows, and
> how the exact token/cost numbers are produced. Kept deliberately short: it is
> the reference a contributor (or an automated issue/PR helper) reads *instead
> of* re-reading `src/`. If you change a module's role or the data flow, update
> this file. A Simplified-Chinese version lives in
> [`ARCHITECTURE-zh-CN.md`](ARCHITECTURE-zh-CN.md).

## What it is (and isn't)

**Claude Code Usage** is a VS Code extension that reports Claude Code token
usage and cost — in the status bar and a dashboard webview — by reading Claude
Code's own local logs. It is deliberately:

- **Claude-only** — built around Claude Code's log format and Anthropic's OAuth
  quota. (DeepSeek etc. are priced as a courtesy for CC-Switch users, but Claude
  is the focus.)
- **Lightweight** — minimal UI, no runtime dependencies, secondary views
  collapsed by default.
- **Token-attribution focused** — the headline numbers are *exact*, read from
  each request's own usage accounting, not estimated.
- **Read-only** over `~/.claude` — it never writes to Claude Code's data.

**Out of scope** (use this list to triage requests): multi-provider/vendor
dashboards as a first-class feature; full billing/invoice reconciliation;
writing to or driving Claude Code; non-usage analytics. Requests that sharpen
token insight, attribution, or the advice experience are the right fit.

## Module map (`src/`)

| Module | Role |
|---|---|
| `extension.ts` | Activation, command registration, and the refresh orchestration: an activity-aware, self-rescheduling timer (faster while you're active, calmer when idle) with a generation guard and coalescing, plus `pauseDashboardRefresh`. Wires loader + status bar + webview + quota client together. |
| `dataLoader.ts` | The data pipeline. Reads `~/.claude/projects/**/*.jsonl`, parses/validates/dedups records, harvests session titles and user-prompt markers, and aggregates everything (`calculateUsageData` + today/month/session/project/group/branch breakdowns). The largest piece of logic. |
| `pricing.ts` | Per-model, per-token rate table (separate input / output / cache-write / cache-read rates), model-family inference, and `[1m]`-context-suffix stripping. `calculateCostBreakdown` turns a usage record into a four-part cost. |
| `statusBar.ts` | The status-bar item: today's cost, the current session, and quota windows (5-hour / weekly), with roll-forward of expired windows and a rich tooltip. |
| `webview.ts` | The dashboard: tabbed views (overview, sessions, projects, content, …), the gridded stacked cost-composition charts, and sortable tables. By far the biggest file — almost all UI lives here. |
| `claudeApiClient.ts` | Anthropic OAuth quota: reads `~/.claude/.credentials.json`, refreshes the token (re-reading disk first), and fetches real utilisation from `api.anthropic.com/api/oauth/usage`. Falls back from `fetch` to the system `curl` when Anthropic's TLS-fingerprint gate returns `403 "Request not allowed"`; 60s cool-down on HTTP 429. |
| `advisor.ts` | The AI-advice feature: sends a compact usage digest to the Claude API (using the user's *own* key) and renders natural-language suggestions. Opt-in. |
| `adviceDemoSample.ts` | Static sample advice (all six languages) shown in the advice panel before a key is configured, so the feature is discoverable. |
| `i18n.ts` | The string table for six languages: `en`, `de-DE`, `zh-TW`, `zh-CN`, `ja`, `ko`. Every user-facing string goes through here. |
| `types.ts` | Shared interfaces (`ClaudeUsageRecord`, `UsageData`, `SessionUsage`, `SupportedLanguage`, quota types, …). |

## Data flow

```
~/.claude/projects/<encoded-cwd>/<session>.jsonl     (one file = one conversation)
        │  read line-by-line, JSON.parse each line
        ▼
validate (is it a usage record?) ─► dedup (messageId+requestId, keep higher tokens)
        │  tag each record with session id + project (real cwd preferred)
        ▼
ClaudeUsageRecord[]  ──►  calculateUsageData()  ──►  UsageData
        │                   (sum the 4 token buckets, price each)        │
        │                                                                ├─► status bar (today + quota)
        └─ session titles, user-prompt markers                           └─► webview (breakdowns + charts)
```

Quota is a **separate** path: `claudeApiClient` calls the OAuth usage endpoint
and returns five-hour / seven-day / seven-day-opus utilisation independently of
the local logs (the logs cannot know your plan's limits; only Anthropic does).

## How tokens & cost are computed (exact, not estimated)

Each assistant-response line in the JSONL carries a `message.usage` object — the
**Anthropic API's own token accounting**, the same counts Anthropic bills on.
The extension does not estimate these; it reads, validates, dedups, sums, and
prices them:

1. **Validate** — keep only records whose `usage.input_tokens` is a number (real
   API responses); skip synthetic/error/`<synthetic>` model entries.
2. **Dedup** — hash = `messageId + requestId`; on collision keep the
   higher-token copy (handles proxies that log a placeholder line first, then
   the real values).
3. **Sum** the four buckets into the totals:
   - `input_tokens` — fresh prompt, full price
   - `cache_read_input_tokens` — prefix served from cache, ~10% of input price
   - `cache_creation_input_tokens` — prefix *written* to cache (the
     "Input Cache (Miss)" bar), ~125% of input price; spikes on a model switch
     or after a >5-min gap (the prompt cache is per-model with a ~5-min TTL)
   - `output_tokens` — generated, output price
4. **Price** — each bucket × its per-model rate (`pricing.ts`); cost = the sum.

The **only** estimates in the product are the Content tab's character-based
"what's consuming tokens" breakdown (and the planned v2.2 model-fit /
cache-waste features) — always labelled as estimates and never folded into the
exact totals. "Messages" counts user-typed prompts only, via synthetic
zero-token marker records, so it never affects token sums.

## Key invariants (don't break these)

- **Read-only** over `~/.claude`.
- Every user-facing string goes through `i18n.ts` in **all six languages**.
- New settings **default to existing behaviour** (opt-in); any non-read-only or
  risky feature goes under an `experimental.*` key.
- **No new runtime dependencies.**
- Exact totals and labelled estimates never mix.

## Refresh model

The dashboard/status bar stay current via an activity-aware loop in
`extension.ts`: a self-rescheduling timer whose interval shortens when you're
active and lengthens when idle, guarded by a `refreshGen` generation counter and
coalescing so overlapping refreshes can't stack. File-watching of
`~/.claude/projects` (opt-out) gives ~1.5s latency; an interval is the fallback.
`pauseDashboardRefresh` freezes updates while the panel is open for inspection.

## Release

TypeScript strict, clean `npm run compile`; user-visible changes go in
`CHANGELOG.md`; squash-merge to `main`; push a `v*` tag to **upstream**
(`jack21/ClaudeCodeUsage`) → `.github/workflows/publish.yml` verifies the tag
matches `package.json`, packages with `@vscode/vsce`, and publishes to the VS
Code Marketplace + Open VSX, attaching the `.vsix` to a GitHub Release.
