import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { ClaudeApiUsageResponse, ClaudeCredentials } from './types';

// Fetches real 5-hour / weekly limit utilisation from Anthropic's OAuth usage
// endpoint, reusing the credentials Claude Code already stores. This mirrors
// what the `/usage` command shows. Approach adapted from upstream PR #9
// (jack21/ClaudeCodeUsage).
//
// HTTP strategy (added in 2.0): try Node's built-in `fetch` first — it's the
// simplest path and works wherever Anthropic accepts it. If `fetch` comes
// back with `403 "Request not allowed"`, fall back to the system `curl`
// binary, because Anthropic's edge fingerprints the TLS ClientHello
// (JA3/JA4) and currently rejects Node's openssl handshake while accepting
// curl's. `curl.exe` ships with Windows 10+ (2018) and is universally
// available on macOS / Linux. Every step is logged to the
// "Claude Code Usage" output channel for diagnosis.

interface HttpResponse {
  status: number;
  body: string;
}

export class ClaudeApiClient {
  private readonly credentialsPath: string;
  private credentials: ClaudeCredentials | null = null;
  private rateLimitedUntil: number = 0;
  private out: vscode.OutputChannel | null;
  // Once curl has succeeded after fetch failed, remember so we don't keep
  // paying the cost of a doomed fetch attempt on every refresh.
  private preferCurl: boolean = false;

  constructor(out: vscode.OutputChannel | null = null) {
    this.credentialsPath = path.join(os.homedir(), '.claude', '.credentials.json');
    this.out = out;
  }

  private log(line: string): void {
    if (this.out) {
      const ts = new Date().toLocaleTimeString(undefined, { hour12: false });
      this.out.appendLine(`[${ts}] ${line}`);
    }
  }

  private async loadCredentials(): Promise<ClaudeCredentials | null> {
    try {
      if (!fs.existsSync(this.credentialsPath)) {
        this.log(`credentials: missing at ${this.credentialsPath}`);
        return null;
      }
      const content = await fs.promises.readFile(this.credentialsPath, 'utf-8');
      const parsed = JSON.parse(content) as ClaudeCredentials;
      if (!parsed || !parsed.claudeAiOauth || !parsed.claudeAiOauth.accessToken) {
        this.log('credentials: file present but no claudeAiOauth.accessToken');
        return null;
      }
      this.credentials = parsed;
      return parsed;
    } catch (e) {
      this.log(`credentials: read failed: ${(e as Error).message}`);
      return null;
    }
  }

  private async saveCredentials(credentials: ClaudeCredentials): Promise<void> {
    await fs.promises.writeFile(this.credentialsPath, JSON.stringify(credentials), 'utf-8');
    this.credentials = credentials;
  }

  private isTokenExpired(credentials: ClaudeCredentials): boolean {
    return Date.now() >= credentials.claudeAiOauth.expiresAt - 60 * 1000;
  }

  private async refreshAccessToken(credentials: ClaudeCredentials): Promise<ClaudeCredentials> {
    const r = await this.request('https://console.anthropic.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: credentials.claudeAiOauth.refreshToken,
        grant_type: 'refresh_token'
      })
    });
    if (r.status !== 200) {
      throw new Error(`Token refresh failed: ${r.status}`);
    }
    const data = JSON.parse(r.body) as { access_token: string; expires_in: number };
    const updated: ClaudeCredentials = {
      ...credentials,
      claudeAiOauth: {
        ...credentials.claudeAiOauth,
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000
      }
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
      this.log('token: expired, refreshing');
      try {
        credentials = await this.refreshAccessToken(credentials);
      } catch (e) {
        this.log(`token: refresh failed: ${(e as Error).message}`);
        return null;
      }
    }
    return credentials;
  }

  /** Run an HTTP request via fetch, falling back to curl on TLS-fingerprint
   * rejection ("403 Request not allowed"). */
  private async request(
    url: string,
    opts: { method?: string; headers?: Record<string, string>; body?: string }
  ): Promise<HttpResponse> {
    if (!this.preferCurl) {
      try {
        const r = await this.requestViaFetch(url, opts);
        if (r.status === 403 && r.body.includes('Request not allowed')) {
          this.log(`fetch: 403 "Request not allowed" → falling back to curl (Anthropic TLS-fingerprint gate)`);
          this.preferCurl = true;
        } else {
          this.log(`fetch: ${r.status} ${url}`);
          return r;
        }
      } catch (e) {
        this.log(`fetch: error ${(e as Error).message} → trying curl`);
      }
    }
    const r = await this.requestViaCurl(url, opts);
    this.log(`curl:  ${r.status} ${url}`);
    return r;
  }

  private async requestViaFetch(
    url: string,
    opts: { method?: string; headers?: Record<string, string>; body?: string }
  ): Promise<HttpResponse> {
    if (typeof fetch === 'undefined') {
      throw new Error('fetch unavailable in this VS Code version');
    }
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: opts.headers,
      body: opts.body
    });
    return { status: res.status, body: await res.text() };
  }

  private requestViaCurl(
    url: string,
    opts: { method?: string; headers?: Record<string, string>; body?: string; timeoutSec?: number }
  ): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const args: string[] = ['-sS', '-w', '\n__CCU_STATUS__%{http_code}', '--max-time', String(opts.timeoutSec ?? 15)];
      if (opts.method && opts.method !== 'GET') {
        args.push('-X', opts.method);
      }
      for (const [k, v] of Object.entries(opts.headers || {})) {
        args.push('-H', `${k}: ${v}`);
      }
      if (opts.body !== undefined) {
        args.push('--data-binary', '@-');
      }
      args.push(url);

      // On Windows be explicit about the .exe extension so spawn doesn't
      // depend on PATHEXT resolution; on POSIX 'curl' is correct.
      const cmd = process.platform === 'win32' ? 'curl.exe' : 'curl';
      const child = spawn(cmd, args, { shell: false, windowsHide: true });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (c: Buffer) => (stdout += c.toString('utf-8')));
      child.stderr.on('data', (c: Buffer) => (stderr += c.toString('utf-8')));
      child.on('error', (e) => {
        this.log(`curl: spawn error ${(e as Error).message} (is curl on PATH?)`);
        reject(e);
      });
      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`curl exit ${code}: ${stderr.trim().slice(0, 200)}`));
        }
        const m = stdout.match(/^([\s\S]*)\n__CCU_STATUS__(\d{3})$/);
        if (!m) {
          return reject(new Error(`Could not parse curl output: ${stdout.slice(0, 200)}`));
        }
        resolve({ status: parseInt(m[2], 10), body: m[1] });
      });
      if (opts.body !== undefined) {
        child.stdin.end(opts.body);
      } else {
        child.stdin.end();
      }
    });
  }

  private callUsageApi(accessToken: string): Promise<HttpResponse> {
    return this.request('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Fetch current usage limits. Returns null (no error) when the user is not
   * signed in, when rate-limited, when neither fetch nor curl can complete,
   * or when anything else goes wrong. All decisions are logged to the
   * "Claude Code Usage" output channel for diagnosis.
   */
  async fetchUsageLimits(): Promise<ClaudeApiUsageResponse | null> {
    if (Date.now() < this.rateLimitedUntil) {
      this.log(`skip: cooling down for ${Math.round((this.rateLimitedUntil - Date.now()) / 1000)}s after 429`);
      return null;
    }

    try {
      const credentials = await this.getValidCredentials();
      if (!credentials) {
        return null;
      }

      let response = await this.callUsageApi(credentials.claudeAiOauth.accessToken);

      if (response.status === 429) {
        this.rateLimitedUntil = Date.now() + 5 * 60 * 1000;
        this.log('429: rate-limited, cooling down 5 min');
        return null;
      }

      // One retry after a forced token refresh on 401.
      if (response.status === 401) {
        this.log('401: forcing token refresh and retrying once');
        try {
          const refreshed = await this.refreshAccessToken(credentials);
          response = await this.callUsageApi(refreshed.claudeAiOauth.accessToken);
        } catch (e) {
          this.log(`401 retry: refresh failed: ${(e as Error).message}`);
          return null;
        }
      }

      if (response.status !== 200) {
        this.log(`usage: non-200 (${response.status}); body head: ${response.body.slice(0, 200)}`);
        return null;
      }
      const data = JSON.parse(response.body) as ClaudeApiUsageResponse;
      this.log(`usage: ok — 5h=${data.five_hour?.utilization ?? 'n/a'}%, wk=${data.seven_day?.utilization ?? 'n/a'}%`);
      return data;
    } catch (e) {
      this.log(`usage: exception: ${(e as Error).message}`);
      return null;
    }
  }
}
