import { guardedFetch } from "./guard"

export type Role = "system" | "user" | "assistant" | "tool"

export interface ToolCall {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

export interface ChatMessage {
  role: Role
  content: string | null
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
}

export type StreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "content"; text: string }
  | { type: "toolCall"; index: number; id?: string; name?: string; argumentsDelta?: string }
  | { type: "usage"; usage: Usage }
  | { type: "finish"; reason: string }

export interface ClientOptions {
  baseURL: string
  apiKey: string
}

export interface ModelInfo {
  id: string
  maxModelLen: number
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
  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools
    body.tool_choice = "auto"
  }
  if (typeof params.temperature === "number") body.temperature = params.temperature
  if (typeof params.topP === "number") body.top_p = params.topP
  if (typeof params.topK === "number") body.top_k = params.topK
  if (typeof params.maxTokens === "number") body.max_tokens = params.maxTokens

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
    throw new Error(`oMLX chat returned HTTP ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`)
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

        const choice = chunk?.choices?.[0]
        if (choice) {
          const delta = choice.delta ?? {}
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
