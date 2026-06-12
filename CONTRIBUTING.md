# Contributing

Thanks for your interest in Claude Code Usage — issues, PRs and ideas are
genuinely welcome. This is a small, focused project and contributions are how
it grows.

## Project scope

Before proposing a feature, it helps to know the positioning: this extension is
intentionally **Claude-only and lightweight**, prioritising **token-precision**
(seeing where tokens go) over cost-precision, and using AI to help people use
Claude Code better. Multi-provider monitoring and full billing reconciliation
are explicitly out of scope. Features that sharpen token attribution or the
advice experience are the best fit.

## Development setup

```bash
npm install
npm run compile          # tsc -> out/
npm run watch            # recompile on change
```

- Press **F5** in VS Code to launch the Extension Development Host and test
  your changes manually.
- Package a `.vsix` with `npx @vscode/vsce package`.

The extension reads `~/.claude/projects/**/*.jsonl` **read-only** — it never
writes to your Claude data.

## Pull requests

- Keep each PR focused on one logical change.
- Run `npm run compile` and make sure it's clean before opening the PR.
- Describe the problem and the fix; screenshots help for UI changes.
- If your change affects user-facing behaviour, update `CHANGELOG.md` and the
  relevant parts of `README.md`.

## Tests

There isn't a full test suite yet (tracked in
[#25](https://github.com/jack21/ClaudeCodeUsage/issues/25)). The pure-logic
modules — pricing (`pricing.ts`), aggregation (`dataLoader.ts`), quota-window
handling (`statusBar.ts`), i18n formatting (`i18n.ts`) — are the high-value
targets for `node:test`. If you add logic to these, lightweight tests are very
welcome.

## Releases

Releases are automated and contributor-friendly — you never touch versions or
tags:

1. **Open a PR.** It's auto-labelled from your branch/title prefix (`fix/…`,
   `feat/…`, `docs/…`); a maintainer can adjust the label. The label decides the
   version bump (`feature` → minor, `breaking` → major, otherwise patch).
2. **A maintainer merges it.** [Release Drafter](https://github.com/release-drafter/release-drafter)
   then adds your change to a continuously-updated **draft GitHub Release** and
   recomputes the next version.
3. **To ship, a maintainer reviews that draft and clicks Publish.** That creates
   the tag and triggers `publish.yml`, which packages and pushes to the VS Code
   Marketplace + Open VSX and attaches the `.vsix`.

Because changes ship by **merging** your PR — not by re-applying it — your commit
authorship and the PR's *merged* status are preserved.

## Code of conduct

Be kind and constructive. We're all here to make a useful tool.
