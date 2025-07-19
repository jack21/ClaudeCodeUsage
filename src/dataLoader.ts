import { readFile } from 'node:fs/promises';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { glob } from 'tinyglobby';
import { z } from 'zod';
import { ClaudeUsageRecord, UsageData, SessionData } from './types';
import { calculateCostFromTokens } from './pricing';

// Constants
const CLAUDE_CONFIG_DIR_ENV = 'CLAUDE_CONFIG_DIR';
const CLAUDE_PROJECTS_DIR_NAME = 'projects';
const DEFAULT_CLAUDE_CODE_PATH = '.claude';
const USAGE_DATA_GLOB_PATTERN = '**/*.jsonl';
const USER_HOME_DIR = os.homedir();

// XDG config directory
const XDG_CONFIG_DIR = process.env.XDG_CONFIG_HOME || path.join(USER_HOME_DIR, '.config');
const DEFAULT_CLAUDE_CONFIG_PATH = path.join(XDG_CONFIG_DIR, 'claude');

// Usage data schema for validation
const usageDataSchema = z.object({
  timestamp: z.string(),
  version: z.string().optional(),
  message: z.object({
    usage: z.object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      cache_creation_input_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional(),
    }),
    model: z.string().optional(),
    id: z.string().optional(),
    content: z.array(z.object({
      text: z.string().optional(),
    })).optional(),
  }),
  costUSD: z.number().optional(),
  requestId: z.string().optional(),
  isApiErrorMessage: z.boolean().optional(),
});

export class ClaudeDataLoader {

  static getClaudePaths(): string[] {
    const paths: string[] = [];
    const normalizedPaths = new Set<string>();

    // Check environment variable first (supports comma-separated paths)
    const envPaths = (process.env[CLAUDE_CONFIG_DIR_ENV] ?? '').trim();
    if (envPaths !== '') {
      const envPathList = envPaths.split(',').map(p => p.trim()).filter(p => p !== '');
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
    const defaultPaths = [
      DEFAULT_CLAUDE_CONFIG_PATH,
      path.join(USER_HOME_DIR, DEFAULT_CLAUDE_CODE_PATH),
    ];

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
        const files = await glob([USAGE_DATA_GLOB_PATTERN], {
          cwd: claudeDir,
          absolute: true,
          onlyFiles: true,
        });
        allFiles.push(...files);
      }

      const sortedFiles = await this.sortFilesByTimestamp(allFiles);
      const processedHashes = new Set<string>();
      const records: ClaudeUsageRecord[] = [];
      
      for (const file of sortedFiles) {
        try {
          const content = await readFile(file, 'utf-8');
          const lines = content.trim().split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line) as unknown;
              const result = usageDataSchema.safeParse(parsed);
              
              if (!result.success) {
                continue;
              }
              
              const data = result.data;
              const uniqueHash = this.createUniqueHash(data);
              
              if (uniqueHash && processedHashes.has(uniqueHash)) {
                continue;
              }
              
              if (uniqueHash) {
                processedHashes.add(uniqueHash);
              }
              
              records.push(data as ClaudeUsageRecord);
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

    return filesWithTimestamps
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(item => item.file);
  }


  static calculateUsageData(records: ClaudeUsageRecord[]): UsageData {
    const data: UsageData = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 0,
      totalCost: 0,
      messageCount: 0,
      modelBreakdown: {}
    };

    for (const record of records) {
      // 只統計有 usage 和 model 的記錄（通常是 assistant 類型）
      if (!record.message.usage || !record.message.model) {
        continue;
      }

      const usage = record.message.usage;
      const model = record.message.model;

      // 跳過錯誤記錄和無效記錄
      if (model === '<synthetic>' || record.isApiErrorMessage) {
        continue;
      }

      // 跳過所有 token 都是 0 的記錄
      const tokenSum = usage.input_tokens + 
                      usage.output_tokens + 
                      (usage.cache_creation_input_tokens || 0) + 
                      (usage.cache_read_input_tokens || 0);
      if (tokenSum === 0) {
        continue;
      }

      // 使用新的定價模型計算成本
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
          count: 0
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
    const sortedRecords = records.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const now = new Date();
    const sessionRecords = sortedRecords.filter(record => {
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
      sessionEnd
    };
  }

  static getTodayData(records: ClaudeUsageRecord[]): UsageData {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRecords = records.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= today;
    });

    return this.calculateUsageData(todayRecords);
  }

  static getThisMonthData(records: ClaudeUsageRecord[]): UsageData {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthRecords = records.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= monthStart;
    });

    return this.calculateUsageData(monthRecords);
  }

  static getDailyDataForMonth(records: ClaudeUsageRecord[]): { date: string; data: UsageData }[] {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthRecords = records.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= monthStart;
    });

    // Group records by date
    const recordsByDate: Record<string, ClaudeUsageRecord[]> = {};
    
    monthRecords.forEach(record => {
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
        data: this.calculateUsageData(dayRecords)
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return dailyData;
  }
}