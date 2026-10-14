// Turn low-level fetch/oMLX errors into short, actionable messages.

export interface ErrorContext {
  baseURL?: string
  model?: string
}

export function friendlyError(error: unknown, context: ErrorContext = {}): string {
  const raw = error instanceof Error ? error.message : String(error)
  const lower = raw.toLowerCase()
  const at = context.baseURL ? ` at ${context.baseURL}` : ""
  const model = context.model ? `'${context.model}'` : "the model"

  if (error instanceof Error && error.name === "AbortError") return "aborted"

  if (/unable to connect|econnrefused|connection refused|failed to connect|connection (reset|closed)|fetch failed|networkerror|socket hang up/.test(lower)) {
    return `Cannot reach oMLX${at}. Is the oMLX server running?`
  }
  if (/timed? ?out|etimedout/.test(lower)) {
    return `oMLX${at} did not respond in time. It may be busy loading a model; try again.`
  }
  if (/http 401|unauthorized|http 403|forbidden/.test(lower)) {
    return "oMLX rejected the API key. Check ROKARU_OMLX_KEY or the macOS Keychain."
  }
  if (/http 404|not found|no such model|model[^.]{0,40}(not|isn't|is not|unavailable|missing)|model_not_found/.test(lower)) {
    return `oMLX does not have ${model} loaded. Load it in oMLX (or pick another with /model) and try again.`
  }
  if (/prefill memory guard|prefill would require|dynamic ceiling|memory guard|out of memory/.test(lower)) {
    return (
      "oMLX ran out of memory to process this request (prefill memory guard). This is a RAM limit, not the model's " +
      "context window. Try closing other apps, using a smaller model, lowering the model's context window in oMLX, " +
      "or raising its Memory Guard ceiling."
    )
  }
  if (/context[^.]{0,20}(length|window|limit)|too (long|many tokens)|exceeds?.{0,20}context|maximum context/.test(lower)) {
    return "The prompt is too big for this model's context. Use /compact or start a new chat."
  }
  return raw
}

// A short "what to try next" hint for a (already-friendly) error message.
export function errorSuggestion(message: string): string | undefined {
  const lower = message.toLowerCase()
  if (lower.includes("cannot reach omlx")) return "Start oMLX, then retry."
  if (lower.includes("did not respond in time")) return "The model may still be loading — wait a moment and retry."
  if (lower.includes("api key")) return "Set ROKARU_OMLX_KEY or check the macOS Keychain entry, then retry."
  if (lower.includes("does not have") && lower.includes("loaded")) return "Use /model to choose a model that's loaded in oMLX."
  if (lower.includes("out of memory")) return "Close other apps, pick a smaller model, or lower its context window in oMLX."
  if (lower.includes("too big for this model's context")) return "Use /compact, or start a new chat."
  return undefined
}
