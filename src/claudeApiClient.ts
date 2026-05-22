import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ClaudeApiUsageResponse, ClaudeCredentials } from './types';

// Fetches real 5-hour / weekly limit utilisation from Anthropic's OAuth usage
// endpoint, reusing the credentials Claude Code already stores. This mirrors
// what the `/usage` command shows. Approach adapted from upstream PR #9
// (jack21/ClaudeCodeUsage). No configuration is needed — if the user is signed
// in to Claude Code it just works; otherwise it fails quietly.
export class ClaudeApiClient {
  private readonly credentialsPath: string;
  private credentials: ClaudeCredentials | null = null;
  private rateLimitedUntil: number = 0;

  constructor() {
    this.credentialsPath = path.join(os.homedir(), '.claude', '.credentials.json');
  }

  private async loadCredentials(): Promise<ClaudeCredentials | null> {
    try {
      if (!fs.existsSync(this.credentialsPath)) {
        return null;
      }
      const content = await fs.promises.readFile(this.credentialsPath, 'utf-8');
      const parsed = JSON.parse(content) as ClaudeCredentials;
      if (!parsed || !parsed.claudeAiOauth || !parsed.claudeAiOauth.accessToken) {
        return null;
      }
      this.credentials = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  private async saveCredentials(credentials: ClaudeCredentials): Promise<void> {
    await fs.promises.writeFile(this.credentialsPath, JSON.stringify(credentials), 'utf-8');
    this.credentials = credentials;
  }

  private isTokenExpired(credentials: ClaudeCredentials): boolean {
    // 60-second safety buffer.
    return Date.now() >= credentials.claudeAiOauth.expiresAt - 60 * 1000;
  }

  /** Refresh the access token using the refresh token (same endpoint Claude Code uses). */
  private async refreshAccessToken(credentials: ClaudeCredentials): Promise<ClaudeCredentials> {
    const response = await fetch('https://console.anthropic.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: credentials.claudeAiOauth.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    const data = (await response.json()) as { access_token: string; expires_in: number };
    const updated: ClaudeCredentials = {
      ...credentials,
      claudeAiOauth: {
        ...credentials.claudeAiOauth,
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      },
    };
    await this.saveCredentials(updated);
    return updated;
  }

  private async getValidCredentials(): Promise<ClaudeCredentials | null> {
    let credentials = this.credentials || (await this.loadCredentials());
    if (!credentials) {
      return null;
    }
    if (this.isTokenExpired(credentials)) {
      try {
        credentials = await this.refreshAccessToken(credentials);
      } catch {
        return null;
      }
    }
    return credentials;
  }

  private callUsageApi(accessToken: string): Promise<Response> {
    return fetch('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch current usage limits. Returns null (no error) when the user is not
   * signed in, when rate-limited, or when anything goes wrong.
   */
  async fetchUsageLimits(): Promise<ClaudeApiUsageResponse | null> {
    if (typeof fetch === 'undefined') {
      return null;
    }
    if (Date.now() < this.rateLimitedUntil) {
      return null;
    }

    try {
      const credentials = await this.getValidCredentials();
      if (!credentials) {
        return null;
      }

      let response = await this.callUsageApi(credentials.claudeAiOauth.accessToken);

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const backoffMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5 * 60 * 1000;
        this.rateLimitedUntil = Date.now() + backoffMs;
        return null;
      }

      // One retry after a forced token refresh on 401.
      if (response.status === 401) {
        try {
          const refreshed = await this.refreshAccessToken(credentials);
          response = await this.callUsageApi(refreshed.claudeAiOauth.accessToken);
        } catch {
          return null;
        }
      }

      if (!response.ok) {
        return null;
      }
      return (await response.json()) as ClaudeApiUsageResponse;
    } catch {
      return null;
    }
  }
}
