import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ClaudeCredentials, ClaudeApiUsageResponse } from './types';

export class ClaudeApiClient {
  private credentialsPath: string;
  private credentials: ClaudeCredentials | null = null;

  constructor() {
    const homeDir = os.homedir();
    this.credentialsPath = path.join(homeDir, '.claude', '.credentials.json');
  }

  /**
   * Load credentials from disk
   */
  private async loadCredentials(): Promise<ClaudeCredentials | null> {
    try {
      if (!fs.existsSync(this.credentialsPath)) {
        console.warn('[ClaudeAPI] Credentials file not found:', this.credentialsPath);
        return null;
      }

      const content = await fs.promises.readFile(this.credentialsPath, 'utf-8');
      this.credentials = JSON.parse(content);
      return this.credentials;
    } catch (error) {
      console.error('[ClaudeAPI] Failed to load credentials:', error);
      return null;
    }
  }

  /**
   * Save updated credentials to disk
   */
  private async saveCredentials(credentials: ClaudeCredentials): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.credentialsPath,
        JSON.stringify(credentials),
        'utf-8'
      );
      this.credentials = credentials;
    } catch (error) {
      console.error('[ClaudeAPI] Failed to save credentials:', error);
      throw error;
    }
  }

  /**
   * Check if access token is expired or about to expire (within 60 seconds)
   */
  private isTokenExpired(credentials: ClaudeCredentials): boolean {
    const now = Date.now();
    const expiresAt = credentials.claudeAiOauth.expiresAt;
    const bufferTime = 60 * 1000; // 60 seconds buffer
    return now >= (expiresAt - bufferTime);
  }

  /**
   * Refresh the access token using the refresh token
   * Uses console.anthropic.com endpoint (same as Claude Code CLI)
   */
  private async refreshAccessToken(credentials: ClaudeCredentials): Promise<ClaudeCredentials> {
    console.log('[ClaudeAPI] Refreshing access token...');
    const response = await fetch('https://console.anthropic.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: credentials.claudeAiOauth.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };

    const updatedCredentials: ClaudeCredentials = {
      ...credentials,
      claudeAiOauth: {
        ...credentials.claudeAiOauth,
        accessToken: data.access_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
      },
    };

    await this.saveCredentials(updatedCredentials);
    console.log('[ClaudeAPI] Token refreshed successfully');
    return updatedCredentials;
  }

  /**
   * Get valid credentials, refreshing if necessary
   */
  private async getValidCredentials(): Promise<ClaudeCredentials | null> {
    let credentials = this.credentials || await this.loadCredentials();

    if (!credentials) {
      return null;
    }

    if (this.isTokenExpired(credentials)) {
      console.log('[ClaudeAPI] Access token expired, refreshing...');
      try {
        credentials = await this.refreshAccessToken(credentials);
      } catch (error) {
        console.error('[ClaudeAPI] Failed to refresh token:', error);
        return null;
      }
    }

    return credentials;
  }

  /**
   * Fetch usage limits from the Anthropic API
   * Uses api.anthropic.com/api/oauth/usage (NOT claude.ai which has Cloudflare)
   */
  async fetchUsageLimits(): Promise<ClaudeApiUsageResponse | null> {
    try {
      const credentials = await this.getValidCredentials();
      if (!credentials) {
        console.warn('[ClaudeAPI] No valid credentials available. Run "claude auth login" first.');
        return null;
      }

      console.log('[ClaudeAPI] Fetching usage limits from api.anthropic.com...');

      const response = await fetch('https://api.anthropic.com/api/oauth/usage', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.claudeAiOauth.accessToken}`,
          'anthropic-beta': 'oauth-2025-04-20',
          'Content-Type': 'application/json',
        },
      });

      console.log('[ClaudeAPI] Response status:', response.status);

      // If 401, try refreshing token and retry once
      if (response.status === 401) {
        console.log('[ClaudeAPI] Got 401, attempting token refresh and retry...');
        try {
          const refreshed = await this.refreshAccessToken(credentials);
          const retryResponse = await fetch('https://api.anthropic.com/api/oauth/usage', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${refreshed.claudeAiOauth.accessToken}`,
              'anthropic-beta': 'oauth-2025-04-20',
              'Content-Type': 'application/json',
            },
          });

          if (!retryResponse.ok) {
            console.error('[ClaudeAPI] Retry failed:', retryResponse.status);
            return null;
          }

          const data = await retryResponse.json() as ClaudeApiUsageResponse;
          console.log('[ClaudeAPI] Usage limits fetched successfully (after retry)');
          return data;
        } catch (refreshError) {
          console.error('[ClaudeAPI] Token refresh failed:', refreshError);
          return null;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ClaudeAPI] API error:', response.status, errorText);
        return null;
      }

      const data = await response.json() as ClaudeApiUsageResponse;
      console.log('[ClaudeAPI] Usage limits fetched successfully:', JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.error('[ClaudeAPI] Failed to fetch usage limits:', error);
      return null;
    }
  }
}
