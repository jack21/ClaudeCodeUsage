// Optional "usage advice" feature: sends a small usage summary to an
// OpenAI-compatible chat endpoint (e.g. DeepSeek) and returns optimisation
// advice. Only the aggregated summary is sent — never raw conversation content.

export interface AdviceOptions {
  apiKey: string;
  apiUrl: string;
  model: string;
  summary: string;
}

const SYSTEM_PROMPT =
  'You are an advisor that helps developers use Claude Code more efficiently. ' +
  'You are given an aggregated breakdown of their token consumption. ' +
  'Give concise, concrete, actionable advice on how to reduce token usage and ' +
  'work more efficiently. Focus on the biggest consumers. Use short bullet ' +
  'points. Reply in the same language as the data labels in the summary.';

/**
 * Request usage-optimisation advice from an OpenAI-compatible chat API.
 * @returns the advice text (markdown)
 */
export async function getUsageAdvice(options: AdviceOptions): Promise<string> {
  if (typeof fetch === 'undefined') {
    throw new Error('Network fetch is not available in this VS Code version.');
  }

  const response = await fetch(options.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      stream: false,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: options.summary },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`API ${response.status}: ${detail.slice(0, 300)}`);
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
