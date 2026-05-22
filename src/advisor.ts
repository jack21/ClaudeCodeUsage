// Optional "usage advice" feature: sends a usage summary (and, optionally, a
// sample of the developer's own prompts) to an OpenAI-compatible chat endpoint
// (e.g. DeepSeek) and returns advice on how to use Claude Code more effectively.

export interface AdviceOptions {
  apiKey: string;
  apiUrl: string;
  model: string;
  summary: string;
  // '', 'high' or 'max' — passed as reasoning_effort for models that support it.
  reasoningEffort?: string;
}

const SYSTEM_PROMPT =
  'You are a coaching advisor that helps a developer use the Claude Code AI ' +
  'coding agent more effectively. You are given a breakdown of their usage and ' +
  'a sample of their actual prompts. Your PRIMARY goal: advise how to write ' +
  'clearer, more complete and more precise instructions so tasks are completed ' +
  'correctly and efficiently — point at concrete weaknesses in the sample ' +
  'prompts and show better rewrites. SECONDARY goal: where it does not hurt ' +
  'clarity, suggest ways to reduce token consumption. Be concrete and ' +
  'actionable, use short sections and bullet points, and reply in the same ' +
  'language as the prompts.';

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
  if (typeof fetch === 'undefined') {
    throw new Error('Network fetch is not available in this VS Code version.');
  }

  const body: Record<string, unknown> = {
    model: options.model,
    stream: false,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: options.summary },
    ],
  };
  // Reasoning effort (supported by e.g. DeepSeek V4). Ignored by models that
  // do not recognise the fields.
  if (options.reasoningEffort && options.reasoningEffort.trim() !== '') {
    body.reasoning_effort = options.reasoningEffort.trim();
    body.thinking = { type: 'enabled' };
  }

  const response = await fetch(normalizeUrl(options.apiUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const hint =
      response.status === 404
        ? ' (check adviceApiUrl — for DeepSeek it is https://api.deepseek.com/chat/completions)'
        : '';
    throw new Error(`API ${response.status}${hint}: ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content || content.trim() === '') {
    throw new Error('The model returned an empty response.');
  }
  return content;
}
