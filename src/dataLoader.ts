import * as fs from 'fs';
import { readFile } from 'node:fs/promises';
import * as os from 'os';
import * as path from 'path';
// Removed tinyglobby dependency - using native fs instead
// Removed zod dependency - using native validation instead
import { calculateCostBreakdown } from './pricing';
import {
  BranchUsage,
  ClaudeUsageRecord,
  ContentAnalysis,
  ContentSlice,
  ProjectGroup,
  ProjectUsage,
  SessionData,
  SessionUsage,
  UsageData,
} from './types';

// Constants
const CLAUDE_CONFIG_DIR_ENV = 'CLAUDE_CONFIG_DIR';
const CLAUDE_PROJECTS_DIR_NAME = 'projects';
const DEFAULT_CLAUDE_CODE_PATH = '.claude';
const USAGE_DATA_GLOB_PATTERN = '**/*.jsonl';
const USER_HOME_DIR = os.homedir();

// XDG config directory
const XDG_CONFIG_DIR = process.env.XDG_CONFIG_HOME || path.join(USER_HOME_DIR, '.config');
const DEFAULT_CLAUDE_CONFIG_PATH = path.join(XDG_CONFIG_DIR, 'claude');

// Native file search function to replace tinyglobby
async function findJsonlFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function searchRecursively(currentDir: string) {
    try {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await searchRecursively(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore permission errors and continue
      console.warn(`Cannot read directory ${currentDir}:`, error);
    }
  }

  await searchRecursively(dir);
  return files;
}

// Identify usage records by structural shape only.
//
// Previously we dropped any record whose secondary fields had an unexpected
// type (e.g. `model` is null, `requestId` is a number). That cost us records
// from proxies and from new Claude Code features (xhigh / ultracode /
// workflow) that occasionally write atypical field types. Now we accept any
// record that has the minimum it takes to count tokens — timestamp + the
// numeric token fields — and downstream code is responsible for coercing the
// optional fields safely.
//
// The companion function `validationDropReason` lets the loader log *why* a
// record was rejected so users can spot format drift without us guessing.
function validateUsageRecord(data: any): data is ClaudeUsageRecord {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.timestamp !== 'string') return false;
  if (!data.message || typeof data.message !== 'object') return false;
  if (!data.message.usage || typeof data.message.usage !== 'object') return false;
  const usage = data.message.usage;
  // We require both token fields to be numbers — they are the whole point of
  // the record. Anything else is best-effort: a missing model, a null
  // requestId, an isApiErrorMessage that's "true" (string) — they get
  // accepted now, and the aggregators treat the value as 0/undefined.
  if (typeof usage.input_tokens !== 'number') return false;
  if (typeof usage.output_tokens !== 'number') return false;
  return true;
}

function validationDropReason(data: any): string {
  if (!data || typeof data !== 'object') return 'not-an-object';
  if (typeof data.timestamp !== 'string') return 'timestamp-missing-or-non-string';
  if (!data.message || typeof data.message !== 'object') return 'message-missing';
  if (!data.message.usage || typeof data.message.usage !== 'object') return 'usage-missing';
  if (typeof data.message.usage.input_tokens !== 'number') return 'input_tokens-not-a-number';
  if (typeof data.message.usage.output_tokens !== 'number') return 'output_tokens-not-a-number';
  return 'other';
}

// --- Content-consumption analysis helpers ---
// These estimate which conversation content uses tokens. Token figures are
// derived from character counts, so they are approximate; the relative shares
// between categories are the dependable signal.

interface AnalysisBucket {
  tokens: number;
  chars: number;
  count: number;
}

interface AnalysisAcc {
  cat: Record<string, AnalysisBucket>;
  tools: Record<string, AnalysisBucket>;
  toolIdToName: Record<string, string>;
  seenUuids: Set<string>;
  cutoffMs: number;
  prompts: { cwd: string; text: string }[];
}

// cutoffMs: ignore log lines older than this (0 = no cutoff).
function newAnalysisAcc(cutoffMs: number): AnalysisAcc {
  return { cat: {}, tools: {}, toolIdToName: {}, seenUuids: new Set<string>(), cutoffMs, prompts: [] };
}

// Collect an actual user prompt (capped + truncated) for the AI-advice feature.
function collectPrompt(acc: AnalysisAcc, cwd: string, text: string): void {
  const trimmed = text.trim();
  if (trimmed.length < 4) {
    return;
  }
  acc.prompts.push({ cwd, text: trimmed.slice(0, 2500) });
  if (acc.prompts.length > 600) {
    acc.prompts.shift();
  }
}

// Rough token estimate from text length (CJK characters are denser than ASCII).
function estimateTokens(text: string): number {
  const len = text.length;
  if (len === 0) {
    return 0;
  }
  if (len > 200000) {
    return Math.round(len / 4);
  }
  let cjk = 0;
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x3000 && code <= 0x9fff) {
      cjk++;
    }
  }
  return Math.round(cjk / 1.5 + (len - cjk) / 4);
}

// Flatten a content value (string, or array of blocks) to plain text.
function blockText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    let text = '';
    for (const block of content) {
      if (typeof block === 'string') {
        text += block;
      } else if (block && typeof block === 'object' && typeof (block as { text?: unknown }).text === 'string') {
        text += (block as { text: string }).text;
      }
    }
    return text;
  }
  return '';
}

function addToBucket(map: Record<string, AnalysisBucket>, key: string, text: string): void {
  if (!text) {
    return;
  }
  if (!map[key]) {
    map[key] = { tokens: 0, chars: 0, count: 0 };
  }
  map[key].tokens += estimateTokens(text);
  map[key].chars += text.length;
  map[key].count += 1;
}

// Accumulate one raw log line into the content analysis.
function analyzeLine(parsed: any, acc: AnalysisAcc): void {
  if (!parsed || typeof parsed !== 'object') {
    return;
  }
  // Scope the analysis to a recent window so it reflects current habits.
  if (acc.cutoffMs > 0) {
    const ts = typeof parsed.timestamp === 'string' ? Date.parse(parsed.timestamp) : NaN;
    if (!isNaN(ts) && ts < acc.cutoffMs) {
      return;
    }
  }
  const uuid = typeof parsed.uuid === 'string' ? parsed.uuid : null;
  if (uuid) {
    if (acc.seenUuids.has(uuid)) {
      return;
    }
    acc.seenUuids.add(uuid);
  }

  const message = parsed.message;
  if (!message || typeof message !== 'object') {
    return;
  }
  const role = message.role || parsed.type;
  const content = message.content;
  const cwd = typeof parsed.cwd === 'string' ? parsed.cwd : '';

  if (role === 'assistant') {
    if (Array.isArray(content)) {
      for (const block of content) {
        if (!block || typeof block !== 'object') {
          continue;
        }
        if (block.type === 'text' && typeof block.text === 'string') {
          addToBucket(acc.cat, 'assistantText', block.text);
        } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
          addToBucket(acc.cat, 'assistantThinking', block.thinking);
        } else if (block.type === 'tool_use') {
          if (typeof block.id === 'string' && typeof block.name === 'string') {
            acc.toolIdToName[block.id] = block.name;
          }
          addToBucket(acc.cat, 'toolCalls', JSON.stringify(block.input || {}));
        }
      }
    } else if (typeof content === 'string') {
      addToBucket(acc.cat, 'assistantText', content);
    }
  } else if (role === 'user') {
    if (typeof content === 'string') {
      addToBucket(acc.cat, 'userPrompts', content);
      collectPrompt(acc, cwd, content);
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (!block || typeof block !== 'object') {
          continue;
        }
        if (block.type === 'tool_result') {
          const text = blockText(block.content);
          addToBucket(acc.cat, 'toolResults', text);
          addToBucket(acc.tools, acc.toolIdToName[block.tool_use_id] || 'unknown', text);
        } else if (block.type === 'text' && typeof block.text === 'string') {
          addToBucket(acc.cat, 'userPrompts', block.text);
          collectPrompt(acc, cwd, block.text);
        }
      }
    }
  }
}

function finalizeAnalysis(acc: AnalysisAcc): ContentAnalysis {
  const toSlices = (map: Record<string, AnalysisBucket>): ContentSlice[] =>
    Object.keys(map)
      .map((key) => ({ key, estimatedTokens: map[key].tokens, charCount: map[key].chars, count: map[key].count }))
      .sort((a, b) => b.estimatedTokens - a.estimatedTokens);

  const categories = toSlices(acc.cat);
  return {
    categories,
    toolResultBreakdown: toSlices(acc.tools),
    totalEstimatedTokens: categories.reduce((sum, c) => sum + c.estimatedTokens, 0),
    recentPrompts: acc.prompts.slice(-300),
  };
}

export class ClaudeDataLoader {
  static getClaudePaths(): string[] {
    const paths: string[] = [];
    const normalizedPaths = new Set<string>();

    // Check environment variable first (supports comma-separated paths)
    const envPaths = (process.env[CLAUDE_CONFIG_DIR_ENV] ?? '').trim();
    if (envPaths !== '') {
      const envPathList = envPaths
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p !== '');
      for (const envPath of envPathList) {
        const normalizedPath = path.resolve(envPath);
        if (fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isDirectory()) {
          const projectsPath = path.join(normalizedPath, CLAUDE_PROJECTS_DIR_NAME);
          if (fs.existsSync(projectsPath) && fs.statSync(projectsPath).isDirectory()) {
            if (!normalizedPaths.has(normalizedPath)) {
              normalizedPaths.add(normalizedPath);
              paths.push(normalizedPath);
            }
          }
        }
      }
    }

    // Add default paths if they exist
    const defaultPaths = [DEFAULT_CLAUDE_CONFIG_PATH, path.join(USER_HOME_DIR, DEFAULT_CLAUDE_CODE_PATH)];

    for (const defaultPath of defaultPaths) {
      const normalizedPath = path.resolve(defaultPath);
      if (fs.existsSync(normalizedPath) && fs.statSync(normalizedPath).isDirectory()) {
        const projectsPath = path.join(normalizedPath, CLAUDE_PROJECTS_DIR_NAME);
        if (fs.existsSync(projectsPath) && fs.statSync(projectsPath).isDirectory()) {
          if (!normalizedPaths.has(normalizedPath)) {
            normalizedPaths.add(normalizedPath);
            paths.push(normalizedPath);
          }
        }
      }
    }

    return paths;
  }

  static async findClaudeDataDirectory(customPath?: string): Promise<string | null> {
    if (customPath) {
      const projectsPath = path.join(customPath, CLAUDE_PROJECTS_DIR_NAME);
      if (fs.existsSync(projectsPath) && fs.statSync(projectsPath).isDirectory()) {
        return customPath;
      }
      return null;
    }

    const claudePaths = this.getClaudePaths();
    return claudePaths.length > 0 ? claudePaths[0] : null;
  }

  static async loadUsageRecords(
    dataDirectory?: string,
    options?: { analyzeContent?: boolean; log?: (line: string) => void }
  ): Promise<{ records: ClaudeUsageRecord[]; contentAnalysis: ContentAnalysis | null }> {
    const analyzeContent = options?.analyzeContent !== false; // default true
    const log = options?.log;
    try {
      const claudePaths = dataDirectory ? [dataDirectory] : this.getClaudePaths();
      const allFiles: string[] = [];

      for (const claudePath of claudePaths) {
        const claudeDir = path.join(claudePath, CLAUDE_PROJECTS_DIR_NAME);
        if (fs.existsSync(claudeDir)) {
          const files = await findJsonlFiles(claudeDir);
          allFiles.push(...files);
        }
      }

      const sortedFiles = await this.sortFilesByTimestamp(allFiles);
      // hash → records[] index. Some proxies (mimo / CC Switch) write two
      // records per message: a tokens=0 placeholder when streaming starts,
      // and the real values when the response finishes. Both records share
      // the same messageId, so they hash identically. We keep whichever
      // record has the higher total token sum (issue #18).
      const processedHashes = new Map<string, number>();
      const records: ClaudeUsageRecord[] = [];
      // Content analysis (last 30 days) is optional — skipped when the user
      // disables it via claudeCodeUsage.enableContentAnalysis.
      const analysis = analyzeContent ? newAnalysisAcc(Date.now() - 30 * 24 * 60 * 60 * 1000) : null;
      let fileIndex = 0;
      // Diagnostic counters so the "Show Diagnostic Logs" command can explain
      // how many records were seen / rejected / deduped without speculation.
      const stats = {
        files: sortedFiles.length,
        linesScanned: 0,
        parseErrors: 0,
        rejected: {} as Record<string, number>,
        replacedByDedup: 0,
        skippedByDedup: 0,
        kept: 0,
        // model name → { count, totalTokens }. totalTokens lets us tell whether
        // records exist but are all zeros (proxy-placeholder only).
        models: {} as Record<string, { count: number; tokens: number }>,
      };

      for (const file of sortedFiles) {
        try {
          const content = await readFile(file, 'utf-8');
          const lines = content
            .trim()
            .split('\n')
            .filter((line) => line.trim() !== '');

          // Each .jsonl file is one Claude Code conversation/session.
          const sessionInfo = this.parseSessionInfo(file);

          for (const line of lines) {
            stats.linesScanned += 1;
            try {
              const parsed = JSON.parse(line) as unknown;

              // Feed every line into the content analysis (not only usage records).
              if (analysis) {
                analyzeLine(parsed, analysis);
              }

              if (!validateUsageRecord(parsed)) {
                const reason = validationDropReason(parsed);
                stats.rejected[reason] = (stats.rejected[reason] || 0) + 1;
                continue;
              }

              const data = parsed;
              const uniqueHash = this.createUniqueHash(data);

              // Tag the record with the session/project it came from.
              // Prefer the real working directory (`cwd`) recorded in the log line
              // over the lossy, dash-encoded folder name when it is available.
              const record = data as ClaudeUsageRecord;
              record._sessionId = sessionInfo.sessionId;
              const cwd = (parsed as { cwd?: unknown }).cwd;
              if (typeof cwd === 'string' && cwd.trim() !== '') {
                record._projectPath = cwd;
                record._projectName = this.lastPathSegment(cwd);
              } else {
                record._projectPath = sessionInfo.projectPath;
                record._projectName = sessionInfo.projectName;
              }
              const gitBranch = (parsed as { gitBranch?: unknown }).gitBranch;
              record._gitBranch = typeof gitBranch === 'string' && gitBranch.trim() !== '' ? gitBranch : undefined;

              if (uniqueHash && processedHashes.has(uniqueHash)) {
                // Duplicate — keep whichever record has more tokens. This
                // resolves the proxy "placeholder + real value" pair from
                // issue #18 without needing to detect the proxy.
                const existingIndex = processedHashes.get(uniqueHash)!;
                if (this.tokenSum(record) > this.tokenSum(records[existingIndex])) {
                  records[existingIndex] = record;
                  stats.replacedByDedup += 1;
                } else {
                  stats.skippedByDedup += 1;
                }
                continue;
              }

              records.push(record);
              stats.kept += 1;
              const modelName =
                typeof record.message?.model === 'string' ? record.message.model : '<no-model>';
              if (!stats.models[modelName]) {
                stats.models[modelName] = { count: 0, tokens: 0 };
              }
              stats.models[modelName].count += 1;
              stats.models[modelName].tokens += this.tokenSum(record);
              if (uniqueHash) {
                processedHashes.set(uniqueHash, records.length - 1);
              }
            } catch (parseError) {
              stats.parseErrors += 1;
              console.warn(`Failed to parse line in ${file}:`, parseError);
            }
          }
        } catch (fileError) {
          console.warn(`Failed to read file ${file}:`, fileError);
        }

        // Yield to the event loop every so often so a large history does not
        // block the extension host (keeps VS Code and Claude Code responsive).
        if (++fileIndex % 25 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      if (log) {
        const rejectedSummary = Object.entries(stats.rejected)
          .map(([reason, count]) => `${reason}=${count}`)
          .join(', ') || 'none';
        // List models sorted by kept-record count desc, with each entry's
        // total token sum. If a model shows up with N records but 0 tokens
        // it means every record for that model was a proxy zero-placeholder
        // and the real values were never written — that's the missing-Flash
        // story.
        const fmt = (n: number): string =>
          n >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
          : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K`
          : `${n}`;
        const modelsSummary = Object.entries(stats.models)
          .sort(([, a], [, b]) => b.count - a.count)
          .map(([name, m]) => `${name}=${m.count}/${fmt(m.tokens)}`)
          .join(', ') || 'none';
        log(
          `loader: ${stats.files} files, ${stats.linesScanned} lines | ` +
            `kept=${stats.kept}, dedup-replaced=${stats.replacedByDedup}, ` +
            `dedup-skipped=${stats.skippedByDedup}, parse-errors=${stats.parseErrors} | ` +
            `rejected: ${rejectedSummary}`
        );
        log(`loader: models seen: ${modelsSummary}`);
      }
      return { records, contentAnalysis: analysis ? finalizeAnalysis(analysis) : null };
    } catch (error) {
      console.error('Error loading usage records:', error);
      return { records: [], contentAnalysis: null };
    }
  }

  private static createUniqueHash(data: any): string | null {
    const messageId = data.message?.id;
    const requestId = data.requestId;

    if (!messageId && !requestId) {
      return null;
    }

    return `${messageId || 'no-msg'}-${requestId || 'no-req'}`;
  }

  /** Total tokens recorded on a usage record, across all four buckets. Used
   * to decide which of two records sharing the same uniqueHash to keep
   * (issue #18 — proxy writes placeholder then real values). */
  private static tokenSum(r: any): number {
    const u = r?.message?.usage || {};
    return (u.input_tokens || 0) + (u.output_tokens || 0)
      + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  }

  /**
   * Derive session + project info from a usage log file path.
   * Claude Code stores logs as: <claudeDir>/projects/<encoded-cwd>/<session-id>.jsonl
   * The encoded-cwd folder is the working directory with path separators replaced by '-'.
   */
  private static parseSessionInfo(filePath: string): { sessionId: string; projectName: string; projectPath: string } {
    const sessionId = path.basename(filePath, '.jsonl');
    const projectPath = path.basename(path.dirname(filePath));
    // Use the last meaningful segment of the encoded path as a friendly project name.
    const segments = projectPath.split('-').filter((s) => s.length > 0);
    const projectName = segments.length > 0 ? segments[segments.length - 1] : projectPath || 'unknown';
    return { sessionId, projectName, projectPath };
  }

  /** Last segment of a path, handling both '/' and '\\' separators. */
  private static lastPathSegment(p: string): string {
    const parts = p.split(/[\\/]/).filter((s) => s.length > 0);
    return parts.length > 0 ? parts[parts.length - 1] : p;
  }

  /**
   * Context-window size for a single request: every token on the input side
   * (fresh input + cache reads + cache writes). Mirrors what Claude Code's
   * /context command summarises.
   */
  private static recordContextTokens(record: ClaudeUsageRecord): number {
    const usage = record.message.usage;
    return (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  }

  private static async getEarliestTimestamp(filePath: string): Promise<Date | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      for (const line of lines) {
        if (line.trim() === '') continue;

        try {
          const json = JSON.parse(line) as Record<string, unknown>;
          if (typeof json.timestamp === 'string') {
            const date = new Date(json.timestamp);
            if (!isNaN(date.getTime())) {
              return date;
            }
          }
        } catch {
          // Skip invalid lines
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private static async sortFilesByTimestamp(files: string[]): Promise<string[]> {
    const filesWithTimestamps = await Promise.all(
      files.map(async (file) => {
        const timestamp = await this.getEarliestTimestamp(file);
        return {
          file,
          timestamp: timestamp || new Date(0),
        };
      })
    );

    return filesWithTimestamps.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()).map((item) => item.file);
  }

  static calculateUsageData(records: ClaudeUsageRecord[]): UsageData {
    const data: UsageData = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 0,
      totalCost: 0,
      costBreakdown: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      messageCount: 0,
      modelBreakdown: {},
    };

    for (const record of records) {
      // Only count records with usage and model (typically assistant type)
      if (!record.message.usage || !record.message.model) {
        continue;
      }

      const usage = record.message.usage;
      const model = record.message.model;

      // Skip error records and invalid records
      if (model === '<synthetic>' || record.isApiErrorMessage) {
        continue;
      }

      // Skip records where all tokens are 0
      const tokenSum = usage.input_tokens + usage.output_tokens + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
      if (tokenSum === 0) {
        continue;
      }

      // Cost split by token type; the total is the sum of the four components.
      const costParts = calculateCostBreakdown(usage, model);
      const calculatedCost = costParts.input + costParts.output + costParts.cacheWrite + costParts.cacheRead;

      data.totalInputTokens += usage.input_tokens;
      data.totalOutputTokens += usage.output_tokens;
      data.totalCacheCreationTokens += usage.cache_creation_input_tokens || 0;
      data.totalCacheReadTokens += usage.cache_read_input_tokens || 0;
      data.totalCost += calculatedCost;
      data.costBreakdown.input += costParts.input;
      data.costBreakdown.output += costParts.output;
      data.costBreakdown.cacheWrite += costParts.cacheWrite;
      data.costBreakdown.cacheRead += costParts.cacheRead;
      data.messageCount++;

      if (!data.modelBreakdown[model]) {
        data.modelBreakdown[model] = {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          cost: 0,
          count: 0,
        };
      }

      const modelData = data.modelBreakdown[model];
      modelData.inputTokens += usage.input_tokens;
      modelData.outputTokens += usage.output_tokens;
      modelData.cacheCreationTokens += usage.cache_creation_input_tokens || 0;
      modelData.cacheReadTokens += usage.cache_read_input_tokens || 0;
      modelData.cost += calculatedCost;
      modelData.count++;
    }

    return data;
  }

  /**
   * The "current session" shown next to today's cost in the status bar — the
   * single most-recently-active conversation (one `.jsonl` / `_sessionId`),
   * scoped to the current workspace when one is given.
   *
   * Previously this aggregated *all* records from the last 5 hours across every
   * project, so every VS Code window showed the same number regardless of which
   * workspace it was. Now each window reflects its own workspace's current
   * conversation. Returns null if there's been no activity in the last 5 hours
   * (so a stale session doesn't masquerade as "current").
   *
   * @param workspacePath optional current workspace folder; records whose cwd
   *   sits under it are preferred. Falls back to all records if the workspace
   *   has no matching records (e.g. a brand-new folder).
   */
  static getCurrentSessionData(records: ClaudeUsageRecord[], workspacePath?: string): SessionData | null {
    if (records.length === 0) {
      return null;
    }
    const norm = (p: string): string => (p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

    let pool = records;
    if (workspacePath) {
      const wp = norm(workspacePath);
      const scoped = records.filter((r) => norm(r._projectPath || '').startsWith(wp));
      if (scoped.length > 0) {
        pool = scoped;
      }
    }

    // The most recent record identifies the current session.
    let latest = pool[0];
    for (const r of pool) {
      if (new Date(r.timestamp).getTime() > new Date(latest.timestamp).getTime()) {
        latest = r;
      }
    }

    // Recency guard: if the latest activity is older than the 5-hour window,
    // there is no "current" session to show.
    if (Date.now() - new Date(latest.timestamp).getTime() > 5 * 60 * 60 * 1000) {
      return null;
    }

    const sessionId = latest._sessionId;
    const sessionRecords = pool.filter((r) => r._sessionId === sessionId);
    if (sessionRecords.length === 0) {
      return null;
    }

    const usageData = this.calculateUsageData(sessionRecords);
    const times = sessionRecords.map((r) => new Date(r.timestamp).getTime());
    return {
      ...usageData,
      sessionStart: new Date(Math.min(...times)),
      sessionEnd: new Date(Math.max(...times)),
    };
  }

  static getTodayData(records: ClaudeUsageRecord[]): UsageData {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecords = records.filter((record) => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= today;
    });

    return this.calculateUsageData(todayRecords);
  }

  static getThisMonthData(records: ClaudeUsageRecord[]): UsageData {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthRecords = records.filter((record) => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= monthStart;
    });

    return this.calculateUsageData(monthRecords);
  }

  static getDailyDataForMonth(records: ClaudeUsageRecord[]): { date: string; data: UsageData }[] {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthRecords = records.filter((record) => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= monthStart;
    });

    // Group records by date
    const recordsByDate: Record<string, ClaudeUsageRecord[]> = {};

    monthRecords.forEach((record) => {
      const recordDate = new Date(record.timestamp);
      const dateKey = recordDate.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!recordsByDate[dateKey]) {
        recordsByDate[dateKey] = [];
      }
      recordsByDate[dateKey].push(record);
    });

    // Calculate usage data for each day and sort by date (newest first)
    const dailyData = Object.entries(recordsByDate)
      .map(([date, dayRecords]) => ({
        date,
        data: this.calculateUsageData(dayRecords),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return dailyData;
  }

  static getAllTimeData(records: ClaudeUsageRecord[]): UsageData {
    return this.calculateUsageData(records);
  }

  /**
   * Group records by their source session (.jsonl file) and aggregate usage per session.
   * Returns sessions with billable usage, sorted by most recent activity first.
   * @param records All loaded usage records
   * @param limit Maximum number of sessions to return (default 50)
   */
  static getSessionBreakdown(records: ClaudeUsageRecord[], limit: number = 50): SessionUsage[] {
    const recordsBySession: Record<string, ClaudeUsageRecord[]> = {};

    for (const record of records) {
      const sessionId = record._sessionId || 'unknown';
      if (!recordsBySession[sessionId]) {
        recordsBySession[sessionId] = [];
      }
      recordsBySession[sessionId].push(record);
    }

    const sessions: SessionUsage[] = Object.entries(recordsBySession).map(([sessionId, sessionRecords]) => {
      const timestamps = sessionRecords
        .map((r) => new Date(r.timestamp).getTime())
        .filter((t) => !isNaN(t));
      const startTime = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : new Date(0);
      const endTime = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date(0);
      const first = sessionRecords[0];
      const peakContextTokens = sessionRecords.reduce((peak, r) => Math.max(peak, this.recordContextTokens(r)), 0);

      return {
        sessionId,
        projectName: first._projectName || 'unknown',
        projectPath: first._projectPath || '',
        startTime,
        endTime,
        data: this.calculateUsageData(sessionRecords),
        peakContextTokens,
      };
    });

    return sessions
      .filter((s) => s.data.messageCount > 0)
      .sort((a, b) => b.endTime.getTime() - a.endTime.getTime())
      .slice(0, limit);
  }

  /** Normalise a path for case-insensitive comparison and grouping. */
  private static normalizePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  }

  /** Number of leading path segments shared by every segment list. */
  private static commonPrefixLength(lists: string[][]): number {
    if (lists.length === 0) {
      return 0;
    }
    const first = lists[0];
    let len = 0;
    for (let i = 0; i < first.length; i++) {
      if (lists.every((l) => i < l.length && l[i] === first[i])) {
        len++;
      } else {
        break;
      }
    }
    return len;
  }

  /** Original-casing display path for a group, derived from a child's path. */
  private static deriveGroupDisplayPath(childOriginalPath: string, groupKey: string): string {
    const groupSegCount = groupKey.split('/').filter((s) => s.length > 0).length;
    const sep = childOriginalPath.includes('\\') ? '\\' : '/';
    const originalSegments = childOriginalPath.split(/[\\/]/).filter((s) => s.length > 0);
    return originalSegments.slice(0, groupSegCount).join(sep);
  }

  /** Resolve the enclosing git repository root for a path, or null. Walks up the tree. */
  private static resolveGitRoot(startPath: string, cache: Map<string, string | null>): string | null {
    const visited: string[] = [];
    let dir = startPath;
    for (let i = 0; i < 80; i++) {
      if (cache.has(dir)) {
        const cached = cache.get(dir) ?? null;
        for (const v of visited) {
          cache.set(v, cached);
        }
        return cached;
      }
      visited.push(dir);
      let isRepo = false;
      try {
        isRepo = fs.existsSync(path.join(dir, '.git'));
      } catch {
        isRepo = false;
      }
      if (isRepo) {
        for (const v of visited) {
          cache.set(v, dir);
        }
        return dir;
      }
      const parent = path.dirname(dir);
      if (!parent || parent === dir) {
        break;
      }
      dir = parent;
    }
    for (const v of visited) {
      cache.set(v, null);
    }
    return null;
  }

  /**
   * Group records by project (working directory), then group those projects by
   * their enclosing git repository — or, when a project is not inside a repo, by
   * its top-level project folder. Paths that differ only in case are merged.
   * @param records All loaded usage records
   * @param limit Maximum number of project groups to return (default 60)
   */
  static getProjectBreakdown(
    records: ClaudeUsageRecord[],
    limit: number = 60,
    mode: 'git' | 'folder' | 'flat' = 'git'
  ): ProjectGroup[] {
    // 1. Group records per project, merging paths that differ only in case.
    const recordsByKey: Record<string, ClaudeUsageRecord[]> = {};
    const displayPathByKey: Record<string, string> = {};

    for (const record of records) {
      const rawPath = record._projectPath || record._projectName || 'unknown';
      const key = this.normalizePath(rawPath);
      if (!recordsByKey[key]) {
        recordsByKey[key] = [];
        displayPathByKey[key] = rawPath;
      }
      recordsByKey[key].push(record);
    }

    const keys = Object.keys(recordsByKey);
    if (keys.length === 0) {
      return [];
    }

    // 2. Common root — the grouping fallback for projects not inside a git repo.
    const segmentLists = keys.map((k) => k.split('/').filter((s) => s.length > 0));
    const commonRootLen = this.commonPrefixLength(segmentLists);

    // 3. Build a project per key and assign it to a group (git repo, else folder).
    const groups: Record<
      string,
      { records: ClaudeUsageRecord[]; children: ProjectUsage[]; displayPath: string; isGitRepo: boolean }
    > = {};
    const gitCache = new Map<string, string | null>();

    keys.forEach((key, idx) => {
      const projectRecords = recordsByKey[key];
      const originalPath = displayPathByKey[key];
      const segments = segmentLists[idx];

      let groupKey: string;
      let groupDisplayPath: string;
      let isGitRepo = false;

      if (mode === 'flat') {
        // Every working directory is its own group.
        groupKey = segments.join('/');
        groupDisplayPath = originalPath;
      } else {
        let gitRoot: string | null = null;
        if (mode === 'git') {
          gitRoot = this.resolveGitRoot(originalPath, gitCache);
        }
        if (gitRoot) {
          groupKey = this.normalizePath(gitRoot);
          groupDisplayPath = gitRoot;
          isGitRepo = true;
        } else {
          // No git repo (or 'folder' mode): top-level project folder heuristic.
          const groupLen = commonRootLen === 0 ? segments.length : Math.min(segments.length, commonRootLen + 1);
          groupKey = segments.slice(0, groupLen).join('/');
          groupDisplayPath = this.deriveGroupDisplayPath(originalPath, groupKey);
        }
      }

      const timestamps = projectRecords.map((r) => new Date(r.timestamp).getTime()).filter((t) => !isNaN(t));
      const first = projectRecords[0];
      const project: ProjectUsage = {
        projectName: first._projectName || 'unknown',
        projectPath: displayPathByKey[key],
        sessionCount: new Set(projectRecords.map((r) => r._sessionId || 'unknown')).size,
        firstSeen: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : new Date(0),
        lastSeen: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date(0),
        data: this.calculateUsageData(projectRecords),
      };

      if (!groups[groupKey]) {
        groups[groupKey] = { records: [], children: [], displayPath: groupDisplayPath, isGitRepo };
      }
      groups[groupKey].records.push(...projectRecords);
      groups[groupKey].children.push(project);
    });

    // 4. Aggregate each group.
    const result: ProjectGroup[] = Object.values(groups).map((g) => {
      const timestamps = g.records.map((r) => new Date(r.timestamp).getTime()).filter((t) => !isNaN(t));
      const sessionCount = new Set(g.records.map((r) => r._sessionId || 'unknown')).size;
      const children = g.children.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
      const pathSegments = g.displayPath.split(/[\\/]/).filter((s) => s.length > 0);
      const groupName = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : g.displayPath;

      return {
        groupName,
        groupPath: g.displayPath,
        isGitRepo: g.isGitRepo,
        projectCount: children.length,
        sessionCount,
        firstSeen: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : new Date(0),
        lastSeen: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date(0),
        data: this.calculateUsageData(g.records),
        children,
      };
    });

    return result
      .filter((g) => g.data.messageCount > 0)
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, limit);
  }

  /**
   * Group records by git branch (within each project) and aggregate usage.
   * Returns branches with billable usage, sorted by cost descending.
   * @param records All loaded usage records
   * @param limit Maximum number of branches to return (default 60)
   */
  static getBranchBreakdown(records: ClaudeUsageRecord[], limit: number = 60): BranchUsage[] {
    const byKey: Record<string, ClaudeUsageRecord[]> = {};
    for (const record of records) {
      const branch = record._gitBranch && record._gitBranch.trim() !== '' ? record._gitBranch : '-';
      const key = (record._projectName || 'unknown') + ' ' + branch;
      if (!byKey[key]) {
        byKey[key] = [];
      }
      byKey[key].push(record);
    }

    const result: BranchUsage[] = Object.values(byKey).map((recs) => {
      const first = recs[0];
      const branch = first._gitBranch && first._gitBranch.trim() !== '' ? first._gitBranch : '-';
      const timestamps = recs.map((r) => new Date(r.timestamp).getTime()).filter((t) => !isNaN(t));
      return {
        branch,
        projectName: first._projectName || 'unknown',
        projectPath: first._projectPath || '',
        sessionCount: new Set(recs.map((r) => r._sessionId || 'unknown')).size,
        lastSeen: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date(0),
        data: this.calculateUsageData(recs),
      };
    });

    return result
      .filter((b) => b.data.messageCount > 0)
      .sort((a, b) => b.data.totalCost - a.data.totalCost)
      .slice(0, limit);
  }

  /**
   * Newest modification time (ms) across all usage log files. Used to skip
   * pointless reloads when nothing has changed since the last load.
   */
  static async getLatestModifiedTime(dataDirectory?: string): Promise<number> {
    try {
      const claudePaths = dataDirectory ? [dataDirectory] : this.getClaudePaths();
      let latest = 0;
      for (const claudePath of claudePaths) {
        const claudeDir = path.join(claudePath, CLAUDE_PROJECTS_DIR_NAME);
        if (!fs.existsSync(claudeDir)) {
          continue;
        }
        const files = await findJsonlFiles(claudeDir);
        for (const file of files) {
          try {
            const stat = await fs.promises.stat(file);
            if (stat.mtimeMs > latest) {
              latest = stat.mtimeMs;
            }
          } catch {
            // Ignore unreadable files.
          }
        }
      }
      return latest;
    } catch {
      return 0;
    }
  }

  static getDailyDataForSpecificMonth(records: ClaudeUsageRecord[], monthDateString: string): { date: string; data: UsageData }[] {
    // monthDateString format: YYYY-MM-01 (first day of the month)
    const monthDate = new Date(monthDateString);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0); // Last day of the month

    const monthRecords = records.filter((record) => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });

    // Group records by date
    const recordsByDate: Record<string, ClaudeUsageRecord[]> = {};

    monthRecords.forEach((record) => {
      const recordDate = new Date(record.timestamp);
      const dateKey = recordDate.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!recordsByDate[dateKey]) {
        recordsByDate[dateKey] = [];
      }
      recordsByDate[dateKey].push(record);
    });

    // Convert to array and sort by date
    return Object.keys(recordsByDate)
      .sort()
      .map((dateKey) => ({
        date: dateKey,
        data: this.calculateUsageData(recordsByDate[dateKey]),
      }));
  }

  static getDailyDataForAllTime(records: ClaudeUsageRecord[]): { date: string; data: UsageData }[] {
    // Group all records by month for all-time view
    const recordsByMonth: Record<string, ClaudeUsageRecord[]> = {};

    records.forEach((record) => {
      const recordDate = new Date(record.timestamp);
      const monthKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

      if (!recordsByMonth[monthKey]) {
        recordsByMonth[monthKey] = [];
      }
      recordsByMonth[monthKey].push(record);
    });

    // Calculate usage data for each month and sort by month (newest first)
    const monthlyData = Object.entries(recordsByMonth)
      .map(([month, monthRecords]) => ({
        date: month + '-01', // Set to first day of month for date sorting
        data: this.calculateUsageData(monthRecords),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return monthlyData;
  }

  static getHourlyDataForToday(records: ClaudeUsageRecord[]): { hour: string; data: UsageData }[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecords = records.filter((record) => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= today;
    });

    // Group records by hour
    const recordsByHour: Record<string, ClaudeUsageRecord[]> = {};

    todayRecords.forEach((record) => {
      const recordDate = new Date(record.timestamp);
      const hourKey = `${recordDate.getHours().toString().padStart(2, '0')}:00`; // HH:00 format

      if (!recordsByHour[hourKey]) {
        recordsByHour[hourKey] = [];
      }
      recordsByHour[hourKey].push(record);
    });

    // Calculate usage data for each hour and sort by hour
    const hourlyData = Object.entries(recordsByHour)
      .map(([hour, hourRecords]) => ({
        hour,
        data: this.calculateUsageData(hourRecords),
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return hourlyData;
  }

  static getHourlyDataForDate(records: ClaudeUsageRecord[], dateString: string): { hour: string; data: UsageData }[] {
    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);

    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const dateRecords = records.filter((record) => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= targetDate && recordDate < nextDate;
    });

    // Group records by hour
    const recordsByHour: Record<string, ClaudeUsageRecord[]> = {};

    dateRecords.forEach((record) => {
      const recordDate = new Date(record.timestamp);
      const hourKey = `${recordDate.getHours().toString().padStart(2, '0')}:00`; // HH:00 format

      if (!recordsByHour[hourKey]) {
        recordsByHour[hourKey] = [];
      }
      recordsByHour[hourKey].push(record);
    });

    // Calculate usage data for each hour and sort by hour
    const hourlyData = Object.entries(recordsByHour)
      .map(([hour, hourRecords]) => ({
        hour,
        data: this.calculateUsageData(hourRecords),
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return hourlyData;
  }
}
