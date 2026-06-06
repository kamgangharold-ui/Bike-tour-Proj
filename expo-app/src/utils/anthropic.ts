// ─── Claude API ─────────────────────────────────────────────────────────────────
// Direct fetch wrapper (avoids Node built-ins in @anthropic-ai/sdk). Shared by the
// BikAI chat and the map voice command router so there is ONE Claude call path.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export async function callAnthropic(
  system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  opts: { maxTokens?: number } = {},
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: opts.maxTokens ?? 500,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }
  const data = (await res.json()) as { content: { type: string; text: string }[] };
  const first = data.content[0];
  return first?.type === 'text' ? first.text : 'No response generated.';
}
