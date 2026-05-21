import * as fs from 'fs';
import { readFile } from 'node:fs/promises';
import * as os from 'os';
import * as path from 'path';
// Removed tinyglobby dependency - using native fs instead
// Removed zod dependency - using native validation instead
import { calculateCostFromTokens } from './pricing';
import {
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

// Native validation function to replace zod
function validateUsageRecord(data: any): data is ClaudeUsageRecord {
  // Basic structure validation
  if (!data || typeof data !== 'object') return false;

  // Required timestamp
  if (typeof data.timestamp !== 'string') return false;

  // Required message with usage
  if (!data.message || typeof data.message !== 'object') return false;
  if (!data.message.usage || typeof data.message.usage !== 'object') return false;

  const usage = data.message.usage;

  // Required token fields must be numbers
  if (typeof usage.input_tokens !== 'number') return false;
  if (typeof usage.output_tokens !== 'number') return false;

  // Optional fields validation
  if (usage.cache_creation_input_tokens !== undefined && typeof usage.cache_creation_input_tokens !== 'number') return false;
  if (usage.cache_read_input_tokens !== undefined && typeof usage.cache_read_input_tokens !== 'number') return false;

  // Optional fields validation
  if (data.message.model !== undefined && typeof data.message.model !== 'string') return false;
  if (data.message.id !== undefined && typeof data.message.id !== 'string') return false;
  if (data.costUSD !== undefined && typeof data.costUSD !== 'number') return false;
  if (data.requestId !== undefined && typeof data.requestId !== 'string') return false;
  if (data.isApiErrorMessage !== undefined && typeof data.isApiErrorMessage !== 'boolean') return false;

  return true;
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
}

// cutoffMs: ignore log lines older than this (0 = no cutoff).
function newAnalysisAcc(cutoffMs: number): AnalysisAcc {
  return { cat: {}, tools: {}, toolIdToName: {}, seenUuids: new Set<string>(), cutoffMs };
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
    dataDirectory?: string
  ): Promise<{ records: ClaudeUsageRecord[]; contentAnalysis: ContentAnalysis }> {
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
      const processedHashes = new Set<string>();
      const records: ClaudeUsageRecord[] = [];
      // Content analysis covers the last 30 days — recent enough to reflect habits.
      const analysis = newAnalysisAcc(Date.now() - 30 * 24 * 60 * 60 * 1000);

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
            try {
              const parsed = JSON.parse(line) as unknown;

              // Feed every line into the content analysis (not only usage records).
              analyzeLine(parsed, analysis);

              if (!validateUsageRecord(parsed)) {
                continue;
              }

              const data = parsed;
              const uniqueHash = this.createUniqueHash(data);

              if (uniqueHash && processedHashes.has(uniqueHash)) {
                continue;
              }

              if (uniqueHash) {
                processedHashes.add(uniqueHash);
              }

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
              records.push(record);
            } catch (parseError) {
              console.warn(`Failed to parse line in ${file}:`, parseError);
            }
          }
        } catch (fileError) {
          console.warn(`Failed to read file ${file}:`, fileError);
        }
      }

      return { records, contentAnalysis: finalizeAnalysis(analysis) };
    } catch (error) {
      console.error('Error loading usage records:', error);
      return { records: [], contentAnalysis: finalizeAnalysis(newAnalysisAcc(0)) };
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

      // Calculate cost using new pricing model
      const calculatedCost = calculateCostFromTokens(usage, model);

      data.totalInputTokens += usage.input_tokens;
      data.totalOutputTokens += usage.output_tokens;
      data.totalCacheCreationTokens += usage.cache_creation_input_tokens || 0;
      data.totalCacheReadTokens += usage.cache_read_input_tokens || 0;
      data.totalCost += calculatedCost;
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

  static getCurrentSessionData(records: ClaudeUsageRecord[]): SessionData | null {
    if (records.length === 0) {
      return null;
    }

    // Sort records by timestamp
    const sortedRecords = records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const now = new Date();
    const sessionRecords = sortedRecords.filter((record) => {
      const recordTime = new Date(record.timestamp);
      const timeDiff = now.getTime() - recordTime.getTime();
      return timeDiff <= 5 * 60 * 60 * 1000; // 5 hours in milliseconds
    });

    if (sessionRecords.length === 0) {
      return null;
    }

    const usageData = this.calculateUsageData(sessionRecords);
    const sessionStart = new Date(sessionRecords[0].timestamp);
    const sessionEnd = new Date(sessionRecords[sessionRecords.length - 1].timestamp);

    return {
      ...usageData,
      sessionStart,
      sessionEnd,
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
  static getProjectBreakdown(records: ClaudeUsageRecord[], limit: number = 60): ProjectGroup[] {
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
      let isGitRepo: boolean;
      const gitRoot = this.resolveGitRoot(originalPath, gitCache);
      if (gitRoot) {
        groupKey = this.normalizePath(gitRoot);
        groupDisplayPath = gitRoot;
        isGitRepo = true;
      } else {
        // Not in a repo: fall back to the top-level project folder.
        const groupLen = commonRootLen === 0 ? segments.length : Math.min(segments.length, commonRootLen + 1);
        groupKey = segments.slice(0, groupLen).join('/');
        groupDisplayPath = this.deriveGroupDisplayPath(originalPath, groupKey);
        isGitRepo = false;
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
   * Aggregate usage over a rolling time window ending at the current moment.
   * @param records All loaded usage records
   * @param hours Window length in hours
   */
  static getRollingWindowData(records: ClaudeUsageRecord[], hours: number): UsageData {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const windowRecords = records.filter((record) => {
      const t = new Date(record.timestamp).getTime();
      return !isNaN(t) && t >= cutoff;
    });
    return this.calculateUsageData(windowRecords);
  }

  /**
   * Usage in the current anchored 5-hour quota window. Claude Code's 5-hour
   * limit window opens at the first message and lasts exactly 5 hours; the next
   * window opens at the first message after the previous one expired.
   * @returns window usage and when it resets (resetAt null if no active window)
   */
  static getAnchored5hWindow(records: ClaudeUsageRecord[]): { data: UsageData; resetAt: Date | null } {
    const WINDOW_MS = 5 * 60 * 60 * 1000;
    const times = records
      .map((r) => new Date(r.timestamp).getTime())
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b);

    if (times.length === 0) {
      return { data: this.calculateUsageData([]), resetAt: null };
    }

    let windowStart = times[0];
    for (const t of times) {
      if (t >= windowStart + WINDOW_MS) {
        windowStart = t;
      }
    }
    const resetMs = windowStart + WINDOW_MS;
    if (Date.now() >= resetMs) {
      // The last window has already expired — no active window right now.
      return { data: this.calculateUsageData([]), resetAt: null };
    }

    const windowRecords = records.filter((record) => {
      const t = new Date(record.timestamp).getTime();
      return !isNaN(t) && t >= windowStart && t < resetMs;
    });
    return { data: this.calculateUsageData(windowRecords), resetAt: new Date(resetMs) };
  }

  /**
   * Usage in the current weekly quota window, anchored to a fixed weekday/hour.
   * @param resetDay 0=Sunday … 6=Saturday
   * @param resetHour 0-23 (local time)
   */
  static getWeeklyWindow(
    records: ClaudeUsageRecord[],
    resetDay: number,
    resetHour: number
  ): { data: UsageData; resetAt: Date } {
    const now = new Date();
    // Most recent reset boundary at or before now.
    const boundary = new Date(now);
    boundary.setHours(resetHour, 0, 0, 0);
    let dayDiff = boundary.getDay() - resetDay;
    if (dayDiff < 0) {
      dayDiff += 7;
    }
    boundary.setDate(boundary.getDate() - dayDiff);
    if (boundary.getTime() > now.getTime()) {
      boundary.setDate(boundary.getDate() - 7);
    }

    const windowStart = boundary.getTime();
    const resetAt = new Date(windowStart + 7 * 24 * 60 * 60 * 1000);
    const windowRecords = records.filter((record) => {
      const t = new Date(record.timestamp).getTime();
      return !isNaN(t) && t >= windowStart;
    });
    return { data: this.calculateUsageData(windowRecords), resetAt };
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
