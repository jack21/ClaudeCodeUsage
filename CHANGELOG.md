# Changelog

All notable changes to this fork compared to upstream
[`jack21/ClaudeCodeUsage`](https://github.com/jack21/ClaudeCodeUsage) (last
upstream release: 1.0.8). Format follows [Keep a Changelog](https://keepachangelog.com).

## [1.0.17] — Unreleased

### Added

#### Pricing accuracy
- **Opus 4.6 / 4.7 / Sonnet 4.5 / Sonnet 4.6 / Haiku 4.5** added to the pricing
  table (verified against the official Anthropic pricing page).
- Reference pricing for common non-Anthropic models that may appear in proxied
  Claude Code setups: **OpenAI** (GPT-5.x, 4.1.x, 4o, o3, o4-mini), **Google
  Gemini** (2.5 Pro/Flash, 2.0 Flash), **DeepSeek** (chat / reasoner /
  v4-flash), **Moonshot Kimi** (K2.5 / K2.6), **Zhipu GLM** (4.5 / 4.6) and
  **Alibaba Qwen** (Max / Plus / Turbo / Long).
- **Family-aware pricing fallback**: unknown model snapshots are now priced
  against the current tier of their detected family (Opus / Sonnet / Haiku /
  GPT / Gemini / DeepSeek / Kimi / GLM / Qwen) instead of always falling back
  to Sonnet 4.
- **Per-model rates** displayed inline in the model breakdown section.
- **`Refresh Model Pricing`** command + button pulls live prices from
  LiteLLM's public dataset as runtime overrides.

#### Quota tracking (real `/usage` data)
- **5-hour and weekly limit utilisation** + reset times fetched via Claude
  Code's own OAuth session at `~/.claude/.credentials.json` →
  `api.anthropic.com/api/oauth/usage`. Zero configuration. _Approach adapted
  from upstream [PR #9](https://github.com/jack21/ClaudeCodeUsage/pull/9) by
  [@Dobidop](https://github.com/Dobidop)._
- Dedicated, quieter status-bar item shows `5h:N% wk:N%`; warns yellow at
  ≥80%, red at ≥95%.
- Tooltip is a Markdown table with utilisation, reset countdown and weekly
  reset weekday/time.

#### Usage insights
- **Sessions tab** — usage per conversation (one row per `.jsonl` file), with
  project, peak context window, duration and a session-id tooltip. Sortable.
- **Projects tab** — usage aggregated per working directory. Paths that differ
  only in case are merged. Projects are grouped (configurably) by their
  enclosing git repository with sub-folder drill-down. Sortable.
- **Content tab** — estimated breakdown of which conversation content consumes
  tokens (your prompts vs. tool results by tool vs. assistant output /
  thinking), scoped to the last 30 days.
- **Branches tab** — usage aggregated per git branch.
- **Stacked token-composition chart** on the daily / monthly / hourly views,
  with Y-axis and reference lines.
- **Today's hourly chart** now has a Y-axis, two dashed reference lines and a
  value label on every bar; tooltip no longer repeats the hour.
- **Cost composition** in the usage summary: how much of the cost comes from
  input / output / cache-write / cache-read tokens.
- **Cache hit rate** metric in the usage summary.
- **Peak context** column on the Sessions tab, mirroring what `/context`
  reports for a single request.

#### AI advice (opt-in)
- **`Get AI Usage Advice`** command + button. Sends an aggregate summary
  plus a sample of your recent user prompts (or just the aggregates if
  prompts are unavailable) to an OpenAI-compatible chat endpoint
  (DeepSeek V4 Pro by default, `reasoning_effort=max`) and opens the
  optimisation advice as a Markdown document.
- **Scope picker**: overall, or one specific project.
- Output filename is `claude-advice-<scope>-YYYY-MM-DD_HHmm.md`.
- Advice model is instructed to reply in the user's UI language.

#### Quality-of-life
- **Status-bar tooltip** is now an aligned Markdown table.
- Status bar also shows the **current-session cost** next to today's cost.
- **Compact number format** option (`1.2M` / `345K`).
- **Reading-friendly timestamps** ("Today HH:MM", "Yesterday HH:MM",
  "MM-DD HH:MM", "YYYY-MM-DD").
- **Sortable columns** on Sessions / Projects / Branches tabs.
- **`Refresh Model Pricing`** + `Get AI Usage Advice` commands in the
  Command Palette.

#### Settings (all opt-in)
- `enableContentAnalysis` — toggle the Content tab + analysis pipeline.
- `projectGroupingMode` — `git` (default), `folder` (no fs walk) or `flat`.
- `compactNumbers` — toggle `1.2M`/`345K` formatting.
- `usageLimitTracking` — enable/disable the OAuth quota indicator.
- `adviceApiKey` / `adviceApiUrl` / `adviceModel` / `adviceReasoningEffort` —
  AI advice configuration.

### Fixed

- **Opus 4.5** 5-minute cache-write rate: was `$6.00 / MTok`, corrected to
  `$6.25 / MTok` (= 1.25× the input rate).
- **Haiku 3.5** 5-minute cache-write rate: was `$1.60 / MTok` (that's the
  1-hour rate), corrected to `$1.00 / MTok`.
- `claudeCodeUsage.decimalPlaces` setting was ignored by `formatCurrency` —
  now respected throughout the UI.
- Cache metrics renamed to **"Input Cache (Miss/Hit)"** for clarity.

### Performance & stability

- **Idle-aware refresh**: when no log file has changed since the last load,
  the refresh skips the recompute and only updates the (independent) quota
  indicator. Idle ticks now do near-zero work.
- **Non-blocking refresh**: the loader yields to the event loop every 25
  files so a large history no longer freezes the extension host (and the
  Claude Code extension that shares it).
- Refresh uses an `mtime`-based check instead of a fixed 1-minute cache age.

### Acknowledgements

Based on [`jack21/ClaudeCodeUsage`](https://github.com/jack21/ClaudeCodeUsage)
by Jack Wang, MIT-licensed. Significant inspiration / patches from upstream
PRs:

- [#9](https://github.com/jack21/ClaudeCodeUsage/pull/9) — Real 5-hour and
  weekly usage limit tracking via the Anthropic OAuth API, by
  [@Dobidop](https://github.com/Dobidop). The OAuth approach in this fork is
  adapted from that PR.

Many code changes in this fork were drafted with assistance from
[Claude Code](https://claude.com/claude-code) (commits credit
`Co-Authored-By: Claude <noreply@anthropic.com>`).
