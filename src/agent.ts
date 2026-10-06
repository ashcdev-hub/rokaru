import type { RokaruConfig } from "./config"
import { streamChat, type ChatMessage, type ContentPart, type ToolCall, type Usage } from "./omlx"
import { TOOL_MAP, toolSchemas } from "./tools"
import { clearWebAllowlist } from "./web"
import * as store from "./store"

let history: ChatMessage[] = []
let warnedContext = false

export function resetHistory(): void {
  for (const message of history) {
    if (typeof message.content === "string") message.content = ""
    else if (Array.isArray(message.content)) message.content = null
  }
  history = []
  warnedContext = false
  clearWebAllowlist()
}

function systemPrompt(config: RokaruConfig): string {
  const note = config.web?.enabled
    ? " You can search the web read-only with web_search, then read a result with web_fetch. You cannot post or send data anywhere."
    : " You have no network access; do not attempt to reach any host."
  return config.systemPrompt + note
}

export interface Attachment {
  name: string
  dataUrl: string
}

export interface TurnOptions {
  baseURL: string
  apiKey: string
  model: string
  modelLimit: number
  config: RokaruConfig
  workspace: string
  signal: AbortSignal
  attachments?: Attachment[]
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
  const percent = limit > 0 ? (promptTokens / limit) * 100 : 0
  store.setContextPercent(percent)
  if (percent >= 85 && !warnedContext) {
    warnedContext = true
    store.showToast("context 85% full — /compact to free space")
  }
}

// Local models sometimes emit near-JSON argument blobs; try a few cheap repairs
// before giving up.
function parseArgs(raw: string): any {
  if (!raw || raw.trim().length === 0) return {}
  const cleaned = raw
    .replace(/^\s*```[a-z]*\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()
  const candidates = [raw, cleaned, cleaned.replace(/,\s*([}\]])/g, "$1"), cleaned.replace(/'/g, '"')]
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // try the next repair
    }
  }
  return { _raw: raw }
}

async function streamOnce(
  options: TurnOptions,
  assistantId: string,
): Promise<{ content: string; finishReason: string; firstTokenAt: number; hadTools: boolean }> {
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt(options.config) }, ...history]
  const startedAt = performance.now()
  let content = ""
  let reasoning = ""
  let flushedContent = 0
  let flushedReasoning = 0
  let firstTokenAt = 0
  let firstReasoningAt = 0
  let firstContentAt = 0
  let finishReason = "stop"
  let lastFlush = performance.now()
  const toolCallCount = { n: 0 }

  const flush = (force: boolean) => {
    const now = performance.now()
    if (!force && now - lastFlush < 60) return
    lastFlush = now
    if (content.length > flushedContent) {
      store.appendText(assistantId, "text", content.slice(flushedContent))
      flushedContent = content.length
    }
    if (reasoning.length > flushedReasoning) {
      store.appendText(assistantId, "reasoning", reasoning.slice(flushedReasoning))
      flushedReasoning = reasoning.length
    }
  }

  for await (const event of streamChat(
    { baseURL: options.baseURL, apiKey: options.apiKey },
    {
      model: options.model,
      messages,
      tools: toolSchemas(options.config.web?.enabled === true),
      temperature: options.config.sampling.temperature,
      topP: options.config.sampling.topP,
      topK: options.config.sampling.topK,
      maxTokens: options.config.sampling.maxTokens,
    },
    options.signal,
  )) {
    if (event.type === "reasoning") {
      if (!firstTokenAt) firstTokenAt = performance.now()
      if (!firstReasoningAt) firstReasoningAt = performance.now()
      store.setStatus("thinking")
      store.setStatusDetail("")
      reasoning += event.text
      flush(false)
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
      if (!firstContentAt && firstReasoningAt) {
        firstContentAt = performance.now()
        store.setMessageThinking(assistantId, (firstContentAt - firstReasoningAt) / 1000)
      }
      store.setStatus("streaming")
      store.setStatusDetail("")
      content += event.text
      flush(false)
    } else if (event.type === "toolCall") {
      toolCallCount.n += 1
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
  flush(true)
  if (firstReasoningAt && !firstContentAt) {
    store.setMessageThinking(assistantId, (performance.now() - firstReasoningAt) / 1000)
  }
  return { content, finishReason, firstTokenAt, hadTools: toolCallCount.n > 0 }
}

const toolCalls = new Map<number, { id: string; name: string; args: string }>()

export async function runTurn(options: TurnOptions, userText: string): Promise<void> {
  const { config } = options
  const attachments = options.attachments ?? []
  if (attachments.length > 0) {
    const parts: ContentPart[] = []
    if (userText.trim().length > 0) parts.push({ type: "text", text: userText })
    for (const attachment of attachments) {
      parts.push({ type: "image_url", image_url: { url: attachment.dataUrl } })
    }
    history.push({ role: "user", content: parts })
  } else {
    history.push({ role: "user", content: userText })
  }
  store.addUserMessage(userText, attachments.map((a) => a.name))
  store.setError(undefined)

  const baseCtx = {
    workspace: options.workspace,
    extraWritePaths: config.sandbox.extraWritePaths,
    signal: options.signal,
    web: config.web,
  }
  const callImages = new Map<string, string[]>()

  const executeCall = async (assistantId: string, call: { id: string; name: string; args: string }): Promise<string> => {
    const tool = TOOL_MAP.get(call.name)
    if (!tool) {
      const result = `error: unknown tool '${call.name}'`
      store.updateToolPart(assistantId, call.id, { status: "error", result })
      return result
    }
    if (tool.destructive && !store.isToolAllowed(call.name)) {
      const decision = await store.requestPermission(call.name, call.args || "{}", true)
      if (decision === "deny") {
        const result = "The user denied permission to run this tool."
        store.updateToolPart(assistantId, call.id, { status: "denied", result })
        return result
      }
      if (decision === "always") store.allowTool(call.name)
    }
    store.setStatus("tool")
    store.setStatusDetail(call.name)
    store.updateToolPart(assistantId, call.id, { status: "running" })
    try {
      const callCtx = {
        ...baseCtx,
        onDiff: (diff: import("./diff").DiffLine[]) => store.updateToolPart(assistantId, call.id, { diff }),
        onImage: (dataUrl: string) => {
          const list = callImages.get(call.id) ?? []
          list.push(dataUrl)
          callImages.set(call.id, list)
        },
      }
      const result = await tool.run(parseArgs(call.args), callCtx)
      store.updateToolPart(assistantId, call.id, { status: "ok", result })
      return result
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err
      const result = `error: ${(err as Error).message}`
      store.updateToolPart(assistantId, call.id, { status: "error", result })
      return result
    }
  }

  try {
    while (true) {
      store.setStatus("thinking")
      store.setStatusDetail("prefill")
      const assistantId = store.startAssistantMessage()
      toolCalls.clear()

      let attempt = 0
      let result: Awaited<ReturnType<typeof streamOnce>>
      while (true) {
        try {
          result = await streamOnce(options, assistantId)
          break
        } catch (err) {
          const error = err as Error
          if (error.name === "AbortError") throw err
          const gotAnything = toolCalls.size > 0
          if (gotAnything || attempt >= 2) throw err
          attempt += 1
          store.setStatusDetail(`reconnecting (${attempt})…`)
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
        }
      }

      const ordered = [...toolCalls.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)

      if (ordered.length === 0) {
        history.push({ role: "assistant", content: result.content })
        store.setStatus("idle")
        store.setStatusDetail("")
        return
      }

      const assistantToolCalls: ToolCall[] = ordered.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.args },
      }))
      history.push({ role: "assistant", content: result.content || null, tool_calls: assistantToolCalls })

      // Read-only tools can run together; anything that writes or executes waits.
      const isReadOnly = (call: { name: string }) => {
        const tool = TOOL_MAP.get(call.name)
        return tool !== undefined && !tool.destructive
      }
      const concurrent = ordered.filter(isReadOnly)
      const sequential = ordered.filter((call) => !isReadOnly(call))

      const results = new Map<string, string>()
      await Promise.all(
        concurrent.map(async (call) => {
          results.set(call.id, await executeCall(assistantId, call))
        }),
      )
      for (const call of sequential) {
        results.set(call.id, await executeCall(assistantId, call))
      }

      for (const call of ordered) {
        history.push({ role: "tool", tool_call_id: call.id, name: call.name, content: results.get(call.id) ?? "" })
      }

      // Any images a tool wanted the model to see come back as a user turn.
      const viewed = ordered.flatMap((call) => callImages.get(call.id) ?? [])
      if (viewed.length > 0) {
        const parts: ContentPart[] = [{ type: "text", text: "Here are the images you loaded:" }]
        for (const url of viewed) parts.push({ type: "image_url", image_url: { url } })
        history.push({ role: "user", content: parts })
      }

      if (result.finishReason === "stop") {
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

// Replace the conversation with a model-written summary to reclaim context.
export async function compactHistory(options: TurnOptions): Promise<boolean> {
  if (history.length === 0) return false
  const transcript = history
    .map((message) => {
      const body =
        typeof message.content === "string"
          ? message.content
          : Array.isArray(message.content)
            ? message.content
                .filter((part): part is ContentPart & { type: "text" } => part.type === "text")
                .map((part) => part.text)
                .join(" ")
            : ""
      const tools = message.tool_calls ? ` [tools: ${message.tool_calls.map((t) => t.function.name).join(", ")}]` : ""
      return `${message.role}: ${body}${tools}`
    })
    .join("\n")
    .slice(0, 60_000)

  let summary = ""
  try {
    for await (const event of streamChat(
      { baseURL: options.baseURL, apiKey: options.apiKey },
      {
        model: options.model,
        messages: [
          { role: "system", content: "You summarise coding sessions tersely." },
          {
            role: "user",
            content:
              "Summarise this session as concise bullets, preserving decisions, file paths and code details needed to continue.\n\n" +
              transcript,
          },
        ],
        temperature: 0.3,
        maxTokens: 1024,
      },
      options.signal,
    )) {
      if (event.type === "content") summary += event.text
    }
  } catch {
    store.showToast("compact failed")
    return false
  }

  if (summary.trim().length === 0) {
    store.showToast("compact produced nothing")
    return false
  }

  resetHistory()
  history.push({ role: "system", content: `Summary of earlier conversation:\n${summary}` })
  store.addInfoMessage(`compacted conversation:\n${summary}`)
  return true
}
