import type { RokaruConfig } from "./config"
import { streamChat, type ChatMessage, type ToolCall, type Usage } from "./omlx"
import { TOOL_MAP, toolSchemas } from "./tools"
import * as store from "./store"

let history: ChatMessage[] = []

export function resetHistory(): void {
  for (const message of history) {
    if (typeof message.content === "string") message.content = ""
  }
  history = []
}

export interface TurnOptions {
  baseURL: string
  apiKey: string
  model: string
  modelLimit: number
  config: RokaruConfig
  workspace: string
  signal: AbortSignal
}

function applyUsage(usage: Usage): void {
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0
  const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? 0
  const limit = store.modelLimit()
  store.setMetrics({
    ttft: usage.time_to_first_token ?? usage.time_to_first_visible_token ?? 0,
    tps: usage.generation_tokens_per_second ?? 0,
    outputTokens,
    promptTokens,
    cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
    contextLimit: limit,
    model: store.model(),
  })
  store.setPromptTokens(promptTokens)
  store.setContextPercent(limit > 0 ? (promptTokens / limit) * 100 : 0)
}

function parseArgs(raw: string): any {
  if (!raw || raw.trim().length === 0) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return { _raw: raw }
  }
}

export async function runTurn(options: TurnOptions, userText: string): Promise<void> {
  const { config } = options
  history.push({ role: "user", content: userText })
  store.addUserMessage(userText)
  store.setError(undefined)

  const ctx = {
    workspace: options.workspace,
    extraWritePaths: config.sandbox.extraWritePaths,
    signal: options.signal,
  }

  try {
    while (true) {
      store.setStatus("thinking")
      store.setStatusDetail("prompt processing")
      const assistantId = store.startAssistantMessage()

      const startedAt = performance.now()
      let firstTokenAt = 0
      let content = ""
      let finishReason = "stop"
      const toolCalls = new Map<number, { id: string; name: string; args: string }>()

      const messages: ChatMessage[] = [{ role: "system", content: config.systemPrompt }, ...history]

      for await (const event of streamChat(
        { baseURL: options.baseURL, apiKey: options.apiKey },
        {
          model: options.model,
          messages,
          tools: toolSchemas(),
          temperature: config.sampling.temperature,
          topP: config.sampling.topP,
          topK: config.sampling.topK,
          maxTokens: config.sampling.maxTokens,
        },
        options.signal,
      )) {
        if (event.type === "reasoning") {
          if (!firstTokenAt) firstTokenAt = performance.now()
          store.setStatus("thinking")
          store.appendText(assistantId, "reasoning", event.text)
        } else if (event.type === "content") {
          if (!firstTokenAt) {
            firstTokenAt = performance.now()
            store.setMetrics({
              ...store.metrics(),
              ttft: (firstTokenAt - startedAt) / 1000,
              model: store.model(),
              contextLimit: store.modelLimit(),
            })
          }
          store.setStatus("streaming")
          content += event.text
          store.appendText(assistantId, "text", event.text)
        } else if (event.type === "toolCall") {
          const entry = toolCalls.get(event.index) ?? { id: event.id ?? `call_${event.index}`, name: "", args: "" }
          if (event.id) entry.id = event.id
          if (event.name) {
            entry.name = event.name
            store.addToolPart(assistantId, entry.id, entry.name, "")
          }
          if (event.argumentsDelta) {
            entry.args += event.argumentsDelta
            store.updateToolPart(assistantId, entry.id, { args: entry.args })
          }
          toolCalls.set(event.index, entry)
        } else if (event.type === "usage") {
          applyUsage(event.usage)
        } else if (event.type === "finish") {
          finishReason = event.reason
        }
      }

      const ordered = [...toolCalls.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)

      if (ordered.length === 0) {
        history.push({ role: "assistant", content })
        store.setStatus("idle")
        store.setStatusDetail("")
        return
      }

      const assistantToolCalls: ToolCall[] = ordered.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.args },
      }))
      history.push({ role: "assistant", content: content || null, tool_calls: assistantToolCalls })

      for (const call of ordered) {
        const tool = TOOL_MAP.get(call.name)
        if (!tool) {
          const result = `error: unknown tool '${call.name}'`
          store.updateToolPart(assistantId, call.id, { status: "error", result })
          history.push({ role: "tool", tool_call_id: call.id, name: call.name, content: result })
          continue
        }

        const args = parseArgs(call.args)

        if (tool.destructive) {
          const ok = await store.requestPermission(call.name, call.args || "{}", true)
          if (!ok) {
            const result = "The user denied permission to run this tool."
            store.updateToolPart(assistantId, call.id, { status: "denied", result })
            history.push({ role: "tool", tool_call_id: call.id, name: call.name, content: result })
            continue
          }
        }

        store.setStatus("tool")
        store.setStatusDetail(call.name)
        store.updateToolPart(assistantId, call.id, { status: "running" })

        try {
          const result = await tool.run(args, ctx)
          store.updateToolPart(assistantId, call.id, { status: "ok", result })
          history.push({ role: "tool", tool_call_id: call.id, name: call.name, content: result })
        } catch (err) {
          if ((err as Error).name === "AbortError") throw err
          const result = `error: ${(err as Error).message}`
          store.updateToolPart(assistantId, call.id, { status: "error", result })
          history.push({ role: "tool", tool_call_id: call.id, name: call.name, content: result })
        }
      }

      if (finishReason === "stop") {
        store.setStatus("idle")
        store.setStatusDetail("")
        return
      }
    }
  } catch (err) {
    const error = err as Error
    if (error.name === "AbortError") {
      store.setStatus("idle")
      store.setStatusDetail("aborted")
      return
    }
    store.setStatus("error")
    store.setStatusDetail("")
    store.setError(error.message)
  }
}
