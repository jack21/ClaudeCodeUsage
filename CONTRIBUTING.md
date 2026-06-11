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

Releases are automated: pushing a `v*` tag triggers the publish workflow
(Marketplace + Open VSX + GitHub Release). Maintainers handle tagging.

## Code of conduct

Be kind and constructive. We're all here to make a useful tool.
