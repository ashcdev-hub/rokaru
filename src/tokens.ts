// Rough token budgeting. Local models don't expose a tokenizer to rokaru, so we
// approximate. ~4 characters per token is close enough for trimming, and errs
// toward keeping less rather than sending too much.

const CHARS_PER_TOKEN = 4

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

// Trim `text` to roughly `maxTokens`, adding a short marker when cut.
export function truncateToTokens(text: string, maxTokens: number): string {
  if (maxTokens <= 0) return text
  const limit = maxTokens * CHARS_PER_TOKEN
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n… (truncated to ~${maxTokens} tokens)`
}
