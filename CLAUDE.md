# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VSCode extension called "Claude Code Usage" that monitors Claude Code usage and costs in the VSCode status bar. The extension reads Claude Code usage logs and displays real-time statistics including token consumption, costs, and message counts.

## Architecture

- **Main Entry Point**: `src/extension.ts` - Contains the main extension class and activation logic
- **Data Processing**: `src/dataLoader.ts` - Handles loading and parsing Claude usage records from JSONL files
- **UI Components**: 
  - `src/statusBar.ts` - Manages the status bar display
  - `src/webview.ts` - Provides detailed usage breakdown in a webview panel
- **Internationalization**: `src/i18n.ts` - Multi-language support (English, 繁體中文, 简体中文, Japanese, Korean)
- **Type Definitions**: `src/types.ts` - Core interfaces for usage data, session data, and configuration

## Development Commands

```bash
# Compile TypeScript to JavaScript
npm run compile

# Watch mode for development (automatically recompiles on changes)
npm run watch

# Prepare for publishing (runs compile)
npm run vscode:prepublish

# Package extension for distribution
vsce package

# Install extension locally for testing
code --install-extension claude-code-usage-<version>.vsix
```

## Testing and Debugging

- **F5 Key**: Launch Extension Development Host in VSCode to test the extension
- **Extension Host**: The extension runs in a separate VSCode window for debugging
- **Console Logs**: Use VSCode Developer Tools Console to view extension logs

## Key Technical Details

- **Data Source**: Reads from Claude Code's JSONL usage logs located in `~/.config/claude/projects` or `~/.claude/projects`
- **Caching Strategy**: Implements 1-minute cache to avoid excessive file I/O
- **Auto-refresh**: Configurable refresh intervals (minimum 30 seconds)
- **Token Types**: Tracks input, output, cache creation, and cache read tokens
- **Cost Calculation**: Supports different model pricing with tier-based rates
- **File Processing**: Native file search without external dependencies (removed tinyglobby and zod)
- **Data Aggregation**: Processes JSONL files to calculate daily, weekly, monthly, and all-time usage statistics

## Extension Configuration

The extension contributes several VSCode settings under `claudeCodeUsage.*`:
- `refreshInterval`: How often to update data (default: 60 seconds)
- `dataDirectory`: Custom path to Claude data directory
- `language`: Display language preference
- `decimalPlaces`: Precision for cost display

## Build Output

Compiled JavaScript files are output to the `out/` directory, which serves as the extension's entry point via `package.json`'s `main` field.

## Extension Commands

The extension provides three commands accessible via Command Palette:
- `Claude Code Usage: Refresh Usage Data` - Manually refresh the usage statistics
- `Claude Code Usage: Show Usage Details` - Open detailed usage dashboard in webview
- `Claude Code Usage: Open Settings` - Quick access to extension configuration