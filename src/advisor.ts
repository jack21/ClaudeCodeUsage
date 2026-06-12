// Optional "usage advice" feature: sends a usage summary (and, optionally, a
// sample of the developer's own prompts) to an OpenAI-compatible chat endpoint
// (e.g. DeepSeek) and returns advice on how to use Claude Code more effectively.

import { HttpResponse, requestViaCurl, requestViaFetch } from './httpClient';

export interface AdviceOptions {
  apiKey: string;
  apiUrl: string;
  model: string;
  summary: string;
  // Localised name of the user's UI language, e.g. "简体中文 (Simplified Chinese)".
  // Used to force the model to reply in the user's language regardless of the
  // language mix found inside their prompts.
  language: string;
  // '', 'high' or 'max' — passed as reasoning_effort for models that support it.
  reasoningEffort?: string;
  // Abort the request after this long (reasoning models can take minutes).
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

function buildSystemPrompt(language: string): string {
  return (
    'You are a coaching advisor that helps a developer use the Claude Code AI ' +
    'coding agent more effectively. You are given a breakdown of their usage and ' +
    'a sample of their actual prompts. Your PRIMARY goal: advise how to write ' +
    'clearer, more complete and more precise instructions so tasks are completed ' +
    'correctly and efficiently — point at concrete weaknesses in the sample ' +
    'prompts and show better rewrites. SECONDARY goal: where it does not hurt ' +
    'clarity, suggest ways to reduce token consumption. Be concrete and ' +
    'actionable, use short sections and bullet points. ' +
    `IMPORTANT: write your entire reply in ${language}, regardless of the ` +
    'language(s) used in the sample prompts.'
  );
}

/** Normalise an OpenAI-compatible endpoint URL, fixing common mistakes. */
function normalizeUrl(url: string): string {
  let u = (url || '').trim().replace(/\/+$/, '');
  if (u === '') {
    return 'https://api.deepseek.com/chat/completions';
  }
  // DeepSeek's current API endpoint does not use a /v1 prefix.
  if (/api\.deepseek\.com\/v1(\/chat\/completions)?$/.test(u)) {
    u = u.replace('/v1', '');
  }
  if (!u.endsWith('/chat/completions')) {
    u = `${u}/chat/completions`;
  }
  return u;
}

/**
 * Request usage advice from an OpenAI-compatible chat API.
 * @returns the advice text (markdown)
 */
export async function getUsageAdvice(options: AdviceOptions): Promise<string> {
  const body: Record<string, unknown> = {
    model: options.model,
    stream: false,
    messages: [
      { role: 'system', content: buildSystemPrompt(options.language || 'English') },
      { role: 'user', content: options.summary },
    ],
  };
  // Reasoning effort (supported by e.g. DeepSeek V4). Ignored by models that
  // do not recognise the fields.
  if (options.reasoningEffort && options.reasoningEffort.trim() !== '') {
    body.reasoning_effort = options.reasoningEffort.trim();
    body.thinking = { type: 'enabled' };
  }

  const url = normalizeUrl(options.apiUrl);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const reqOpts = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(body),
  };

  // Transport failures ("terminated", connection resets, timeouts) are
  // intermittent on some networks: retry fetch once, then fall back to the
  // system curl — the same transport of last resort the quota client uses.
  // HTTP error statuses are NOT retried (a 401 won't get better).
  let response: HttpResponse;
  try {
    response = await requestViaFetch(url, { ...reqOpts, timeoutMs });
  } catch {
    try {
      response = await requestViaFetch(url, { ...reqOpts, timeoutMs });
    } catch {
      response = await requestViaCurl(url, { ...reqOpts, timeoutSec: Math.ceil(timeoutMs / 1000) });
    }
  }

  if (response.status < 200 || response.status >= 300) {
    const hint =
      response.status === 404
        ? ' (check adviceApiUrl — for DeepSeek it is https://api.deepseek.com/chat/completions)'
        : '';
    throw new Error(`API ${response.status}${hint}: ${response.body.slice(0, 300)}`);
  }

  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = JSON.parse(response.body);
  } catch {
    throw new Error(`The API returned a non-JSON response: ${response.body.slice(0, 200)}`);
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content || content.trim() === '') {
    throw new Error('The model returned an empty response.');
  }
  return content;
}
