import { guardedFetch } from "./guard"

export type Role = "system" | "user" | "assistant" | "tool"

export interface ToolCall {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }

export interface ChatMessage {
  role: Role
  content: string | null | ContentPart[]
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolSchema {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface Usage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  input_tokens?: number
  output_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
  time_to_first_token?: number
  time_to_first_visible_token?: number
  total_time?: number
  prompt_eval_duration?: number
  generation_duration?: number
  prompt_tokens_per_second?: number
  generation_tokens_per_second?: number
}

export interface ChatParams {
  model: string
  messages: ChatMessage[]
  tools?: ToolSchema[]
  temperature?: number
  topP?: number
  topK?: number
  maxTokens?: number
  minP?: number
  repetitionPenalty?: number
  presencePenalty?: number
  // Ask oMLX to stream prompt (prefill) progress chunks.
  returnProgress?: boolean
}

export type StreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "content"; text: string }
  | { type: "toolCall"; index: number; id?: string; name?: string; argumentsDelta?: string }
  | { type: "usage"; usage: Usage }
  | { type: "progress"; total: number; cache: number; processed: number; timeMs: number }
  | { type: "finish"; reason: string }

export interface ClientOptions {
  baseURL: string
  apiKey: string
}

export interface ModelInfo {
  id: string
  maxModelLen: number
}

// A model's residency/settings from GET /v1/models/status.
export interface ModelStatus {
  id: string
  loaded: boolean
  is_loading: boolean
  pinned: boolean
  actualSize: number
  modelType: string
  alias?: string
  thinkingDefault: boolean | null
}

export interface HealthInfo {
  ok: boolean
  loading: boolean
  status: number
  detail?: string
}

export interface Capabilities {
  health: HealthInfo
  models: ModelStatus[]
  // The id of an available embedding engine, if any (enables semantic search).
  embeddingModel?: string
}

// The server root (health lives there, not under /v1).
export function serverOrigin(baseURL: string): string {
  const trimmed = baseURL.replace(/\/+$/, "")
  return trimmed.endsWith("/v1") ? trimmed.slice(0, -3) : trimmed
}

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  }
}

export async function listModels(opts: ClientOptions): Promise<ModelInfo[]> {
  const res = await guardedFetch(`${opts.baseURL}/models`, {
    headers: { Authorization: `Bearer ${opts.apiKey}`, Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`oMLX /models returned HTTP ${res.status}`)
  const body = (await res.json()) as { data?: Array<{ id: string; max_model_len?: number }> }
  return (body.data ?? []).map((m) => ({
    id: m.id,
    maxModelLen: typeof m.max_model_len === "number" ? m.max_model_len : 0,
  }))
}

// GET /health — 200 healthy, 503 while (pinned) models preload. Never throws.
export async function health(opts: ClientOptions, timeoutMs = 4000): Promise<HealthInfo> {
  try {
    const res = await guardedFetch(`${serverOrigin(opts.baseURL)}/health`, {
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (res.status === 503) {
      let detail = "loading"
      try {
        const body = (await res.json()) as { status?: string }
        if (typeof body?.status === "string") detail = body.status
      } catch {
        // keep default
      }
      return { ok: true, loading: true, status: 503, detail }
    }
    return { ok: res.ok, loading: false, status: res.status }
  } catch (err) {
    return { ok: false, loading: false, status: 0, detail: (err as Error).message }
  }
}

// GET /v1/models/status — residency and per-model metadata. Tolerant of shape.
export async function listModelStatus(opts: ClientOptions, timeoutMs = 5000): Promise<ModelStatus[]> {
  try {
    const res = await guardedFetch(`${opts.baseURL}/models/status`, {
      headers: { Authorization: `Bearer ${opts.apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return []
    const body = (await res.json()) as unknown
    const list = Array.isArray(body)
      ? body
      : ((body as { models?: unknown[]; data?: unknown[] }).models ??
        (body as { data?: unknown[] }).data ??
        [])
    return (list as any[]).map((m) => ({
      id: String(m?.id ?? m?.model_id ?? ""),
      loaded: m?.loaded === true,
      is_loading: m?.is_loading === true,
      pinned: m?.pinned === true,
      actualSize: typeof m?.actual_size === "number" ? m.actual_size : 0,
      modelType: String(m?.model_type ?? ""),
      alias: typeof m?.model_alias === "string" ? m.model_alias : undefined,
      thinkingDefault: typeof m?.thinking_default === "boolean" ? m.thinking_default : null,
    }))
  } catch {
    return []
  }
}

// POST /v1/models/{id}/load — warm a model into memory (idempotent). Long-running
// for big models, so callers fire it off and poll status rather than awaiting it.
export async function loadModel(opts: ClientOptions, id: string): Promise<boolean> {
  try {
    const res = await guardedFetch(`${opts.baseURL}/models/${encodeURIComponent(id)}/load`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      signal: AbortSignal.timeout(30 * 60_000),
    })
    return res.ok
  } catch {
    return false
  }
}

// Probe the server for health, model residency and embedding availability.
export async function probeCapabilities(opts: ClientOptions): Promise<Capabilities> {
  const [h, models] = await Promise.all([health(opts), listModelStatus(opts)])
  const embedding = models.find((m) => m.modelType === "embedding")
  return { health: h, models, embeddingModel: embedding?.id }
}

export async function* streamChat(
  opts: ClientOptions,
  params: ChatParams,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    stream: true,
    stream_options: { include_usage: true },
  }
  if (params.returnProgress) body.return_progress = true
  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools
    body.tool_choice = "auto"
  }
  if (typeof params.temperature === "number") body.temperature = params.temperature
  if (typeof params.topP === "number") body.top_p = params.topP
  if (typeof params.topK === "number") body.top_k = params.topK
  if (typeof params.maxTokens === "number") body.max_tokens = params.maxTokens
  if (typeof params.minP === "number") body.min_p = params.minP
  if (typeof params.repetitionPenalty === "number") body.repetition_penalty = params.repetitionPenalty
  if (typeof params.presencePenalty === "number") body.presence_penalty = params.presencePenalty

  const res = await guardedFetch(`${opts.baseURL}/chat/completions`, {
    method: "POST",
    headers: headers(opts.apiKey),
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok || !res.body) {
    let detail = ""
    try {
      detail = await res.text()
    } catch {
      // ignore
    }
    // Prefer the server's own message over a wall of JSON.
    let message = detail
    try {
      const parsed = JSON.parse(detail)
      message = parsed?.error?.message ?? parsed?.message ?? detail
    } catch {
      // not JSON
    }
    message = String(message).replace(/\s+/g, " ").trim().slice(0, 400)
    throw new Error(`oMLX HTTP ${res.status}${message ? `: ${message}` : ""}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let newline: number
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, "")
        buffer = buffer.slice(newline + 1)
        if (!line.startsWith("data:")) continue
        const payload = line.slice(5).trimStart()
        if (payload === "[DONE]") return
        if (payload.length === 0) continue

        let chunk: any
        try {
          chunk = JSON.parse(payload)
        } catch {
          continue
        }

        const progress = chunk?.prompt_progress
        if (progress && typeof progress.processed === "number") {
          yield {
            type: "progress",
            total: Number(progress.total ?? 0),
            cache: Number(progress.cache ?? 0),
            processed: Number(progress.processed ?? 0),
            timeMs: Number(progress.time_ms ?? 0),
          }
        }

        const choice = chunk?.choices?.[0]
        if (choice) {          const delta = choice.delta ?? {}
          if (typeof delta.reasoning_content === "string" && delta.reasoning_content.length > 0) {
            yield { type: "reasoning", text: delta.reasoning_content }
          }
          if (typeof delta.content === "string" && delta.content.length > 0) {
            yield { type: "content", text: delta.content }
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              yield {
                type: "toolCall",
                index: typeof tc.index === "number" ? tc.index : 0,
                id: tc.id,
                name: tc.function?.name,
                argumentsDelta: tc.function?.arguments,
              }
            }
          }
          if (typeof choice.finish_reason === "string") {
            yield { type: "finish", reason: choice.finish_reason }
          }
        }

        if (chunk?.usage) {
          yield { type: "usage", usage: chunk.usage as Usage }
        }
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      // ignore
    }
  }
}
