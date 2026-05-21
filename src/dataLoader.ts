import * as fs from 'fs';
import { readFile } from 'node:fs/promises';
import * as os from 'os';
import * as path from 'path';
// Removed tinyglobby dependency - using native fs instead
// Removed zod dependency - using native validation instead
import { calculateCostFromTokens } from './pricing';
import { ClaudeUsageRecord, ProjectUsage, SessionData, SessionUsage, UsageData } from './types';

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

  static async loadUsageRecords(dataDirectory?: string): Promise<ClaudeUsageRecord[]> {
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

      return records;
    } catch (error) {
      console.error('Error loading usage records:', error);
      return [];
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

  /**
   * Group records by project (working directory) and aggregate usage per project.
   * Returns projects with billable usage, sorted by most recent activity first.
   * @param records All loaded usage records
   * @param limit Maximum number of projects to return (default 50)
   */
  static getProjectBreakdown(records: ClaudeUsageRecord[], limit: number = 50): ProjectUsage[] {
    const recordsByProject: Record<string, ClaudeUsageRecord[]> = {};

    for (const record of records) {
      const key = record._projectPath || record._projectName || 'unknown';
      if (!recordsByProject[key]) {
        recordsByProject[key] = [];
      }
      recordsByProject[key].push(record);
    }

    const projects: ProjectUsage[] = Object.entries(recordsByProject).map(([projectPath, projectRecords]) => {
      const timestamps = projectRecords
        .map((r) => new Date(r.timestamp).getTime())
        .filter((t) => !isNaN(t));
      const firstSeen = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : new Date(0);
      const lastSeen = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date(0);
      const sessionCount = new Set(projectRecords.map((r) => r._sessionId || 'unknown')).size;
      const first = projectRecords[0];

      return {
        projectName: first._projectName || 'unknown',
        projectPath: first._projectPath || projectPath,
        sessionCount,
        firstSeen,
        lastSeen,
        data: this.calculateUsageData(projectRecords),
      };
    });

    return projects
      .filter((p) => p.data.messageCount > 0)
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, limit);
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
