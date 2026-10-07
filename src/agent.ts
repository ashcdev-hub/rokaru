import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { RokaruConfig } from "./config"
import { streamChat, type ChatMessage, type ContentPart, type ToolCall, type Usage } from "./omlx"
import { getTool, toolSchemas, type ToolContext } from "./tools"
import { redactSecrets } from "./redact"
import { clearWebAllowlist } from "./web"
import { clearSnapshots } from "./undo"
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
  clearSnapshots()
}

// AGENTS.md from the workspace, injected into the system prompt (cached).
let projectNotesCache: { workspace: string; text: string } | undefined
export function projectInstructions(workspace: string): string {
  if (projectNotesCache?.workspace === workspace) return projectNotesCache.text
  let text = ""
  try {
    const path = join(workspace, "AGENTS.md")
    if (existsSync(path)) text = readFileSync(path, "utf8").slice(0, 6000).trim()
  } catch {
    // ignore
  }
  projectNotesCache = { workspace, text }
  return text
}

function systemPrompt(config: RokaruConfig, planMode: boolean, workspace: string): string {
  const mode = planMode
    ? " You are in PLAN mode: you may only read and search - do not modify files or run commands. Produce a concrete, ordered plan and stop; the user will switch to build mode to execute it."
    : " You are in BUILD mode: you may edit files and run commands, asking permission as required."
  const web = config.web?.enabled
    ? " You can search the web read-only with web_search, then read a result with web_fetch. You cannot post or send data anywhere."
    : " You have no network access; do not attempt to reach any host."
  const notes = projectInstructions(workspace)
  const project = notes.length > 0 ? `\n\nProject instructions (AGENTS.md):\n${notes}` : ""
  return config.systemPrompt + mode + web + project
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
    elapsed: usage.total_time ?? 0,
    model: store.model(),
  })
  store.setPromptTokens(promptTokens)
  const percent = limit > 0 ? (promptTokens / limit) * 100 : 0
  store.setContextPercent(percent)
  if (percent >= 85 && !warnedContext) {
    warnedContext = true
    store.showToast("context 85% full — /compact to free space", "warn")
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
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(options.config, store.mode() === "plan", options.workspace) },
    ...history,
  ]
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
      tools: toolSchemas(options.config.web?.enabled === true, store.mode() === "plan"),
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

export function isContextOverflow(error: Error): boolean {
  const m = (error.message || "").toLowerCase()
  return /context.*(length|window|limit)|maximum context|too (long|many tokens)|input length|exceed.{0,20}context|context.{0,20}exceed|prefill memory guard|prefill would require|dynamic ceiling|memory guard/.test(
    m,
  )
}

async function runCommand(command: string, cwd: string, signal: AbortSignal): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn("/bin/zsh", ["-c", command], { cwd, env: process.env, signal })
    const cap = 60_000
    let out = ""
    const timer = setTimeout(() => child.kill("SIGKILL"), 120_000)
    child.stdout.on("data", (d) => {
      if (out.length < cap) out += d.toString()
    })
    child.stderr.on("data", (d) => {
      if (out.length < cap) out += d.toString()
    })
    child.on("error", () => {
      clearTimeout(timer)
      resolve({ code: -1, output: `error running: ${command}` })
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, output: out.slice(0, cap) })
    })
  })
}

// The command run after edits to check the project. Configurable, else detected.
function diagnosticsCommand(config: RokaruConfig, workspace: string): string {
  const configured = config.diagnostics.command.trim()
  if (configured.length > 0) return configured
  try {
    const pkgPath = join(workspace, "package.json")
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { scripts?: Record<string, string> }
      const scripts = pkg.scripts ?? {}
      if (scripts.typecheck) return "bun run typecheck"
      if (scripts["check-types"]) return "bun run check-types"
    }
  } catch {
    // ignore
  }
  if (existsSync(join(workspace, "node_modules", ".bin", "tsc"))) return "./node_modules/.bin/tsc --noEmit"
  return ""
}

// A read-only subagent: its own message history, no editing tools, returns text.
async function runSubagent(options: TurnOptions, prompt: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        systemPrompt(options.config, true, options.workspace) +
        " You are a subagent: gather the requested information with the read-only tools and return a concise answer. Never modify anything.",
    },
    { role: "user", content: prompt },
  ]
  const ctx: ToolContext = {
    workspace: options.workspace,
    extraWritePaths: options.config.sandbox.extraWritePaths,
    signal: options.signal,
    web: options.config.web,
  }
  const schemas = toolSchemas(options.config.web?.enabled === true, true).filter((s) => s.function.name !== "task")
  for (let round = 0; round < 8; round++) {
    let content = ""
    const calls = new Map<number, { id: string; name: string; args: string }>()
    for await (const ev of streamChat(
      { baseURL: options.baseURL, apiKey: options.apiKey },
      {
        model: options.model,
        messages,
        tools: schemas,
        temperature: options.config.sampling.temperature,
        topP: options.config.sampling.topP,
        topK: options.config.sampling.topK,
        maxTokens: options.config.sampling.maxTokens,
      },
      options.signal,
    )) {
      if (ev.type === "content") content += ev.text
      else if (ev.type === "toolCall") {
        const entry = calls.get(ev.index) ?? { id: ev.id ?? `call_${ev.index}`, name: "", args: "" }
        if (ev.id) entry.id = ev.id
        if (ev.name) entry.name = ev.name
        if (ev.argumentsDelta) entry.args += ev.argumentsDelta
        calls.set(ev.index, entry)
      }
    }
    const ordered = [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
    if (ordered.length === 0) return content.trim() || "(subagent returned nothing)"
    messages.push({
      role: "assistant",
      content: content || null,
      tool_calls: ordered.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args } })),
    })
    for (const call of ordered) {
      const tool = getTool(call.name)
      if (!tool || tool.destructive) {
        messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: "(subagent is read-only)" })
        continue
      }
      try {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content: redactSecrets(await tool.run(parseArgs(call.args), ctx)),
        })
      } catch (err) {
        if ((err as Error).name === "AbortError") throw err
        messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: `error: ${(err as Error).message}` })
      }
    }
  }
  return "(subagent stopped after too many rounds)"
}

export async function runTurn(options: TurnOptions, userText: string): Promise<void> {
  const { config } = options
  const turnStart = performance.now()
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
  let modified = false
  const capResult = (s: string) => {
    const cap = config.tools.maxResultChars
    return s.length > cap ? `${s.slice(0, cap)}\n… (truncated ${s.length - cap} chars)` : s
  }

  const executeCall = async (assistantId: string, call: { id: string; name: string; args: string }): Promise<string> => {
    if (call.name === "task") {
      store.setStatus("tool")
      store.setStatusDetail("subagent")
      store.updateToolPart(assistantId, call.id, { status: "running" })
      const startedAt = performance.now()
      try {
        const parsed = parseArgs(call.args)
        const prompt = String(parsed?.prompt ?? parsed?.description ?? "").trim() || "Investigate and report concisely."
        const result = capResult(redactSecrets(await runSubagent(options, prompt)))
        store.updateToolPart(assistantId, call.id, { status: "ok", result, durationMs: performance.now() - startedAt })
        return result
      } catch (err) {
        if ((err as Error).name === "AbortError") throw err
        const result = `error: ${(err as Error).message}`
        store.updateToolPart(assistantId, call.id, { status: "error", result, durationMs: performance.now() - startedAt })
        return result
      }
    }
    const tool = getTool(call.name)
    if (!tool) {
      const result = `error: unknown tool '${call.name}'`
      store.updateToolPart(assistantId, call.id, { status: "error", result })
      return result
    }
    if (tool.destructive) {
      const parsed = parseArgs(call.args)
      const commandWord =
        tool.name === "bash" ? String(parsed?.command ?? "").trim().split(/\s+/)[0] ?? "" : ""
      const alreadyAllowed =
        tool.name === "bash" ? store.isCommandAllowed(commandWord) : store.isToolAllowed(call.name)
      if (!alreadyAllowed) {
        const decision = await store.requestPermission(call.name, call.args || "{}", true)
        if (decision === "deny") {
          const result = "The user denied permission to run this tool."
          store.updateToolPart(assistantId, call.id, { status: "denied", result })
          return result
        }
        if (decision === "always") {
          if (tool.name === "bash" && commandWord) store.allowCommand(commandWord)
          else store.allowTool(call.name)
        }
      }
    }
    store.setStatus("tool")
    store.setStatusDetail(call.name)
    store.updateToolPart(assistantId, call.id, { status: "running" })
    const startedAt = performance.now()
    try {
      const callCtx = {
        ...baseCtx,
        onDiff: (diff: import("./diff").DiffLine[]) =>
          store.updateToolPart(assistantId, call.id, {
            diff: diff.map((line) => ({ ...line, text: redactSecrets(line.text) })),
          }),
        onImage: (dataUrl: string) => {
          const list = callImages.get(call.id) ?? []
          list.push(dataUrl)
          callImages.set(call.id, list)
        },
      }
      const result = capResult(redactSecrets(await tool.run(parseArgs(call.args), callCtx)))
      if (tool.name === "write_file" || tool.name === "edit_file") modified = true
      store.updateToolPart(assistantId, call.id, {
        status: "ok",
        result,
        durationMs: performance.now() - startedAt,
      })
      return result
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err
      const result = `error: ${redactSecrets((err as Error).message)}`
      store.updateToolPart(assistantId, call.id, {
        status: "error",
        result,
        durationMs: performance.now() - startedAt,
      })
      return result
    }
  }

  try {
    let round = 0
    let compacted = false
    let ranDiagnostics = false
    // Bound total tool rounds so a confused model can't spin forever.
    for (;;) {
      round += 1
      if (config.tools.maxRounds > 0 && round > config.tools.maxRounds) {
        store.addInfoMessage(`stopped after ${config.tools.maxRounds} tool rounds.`)
        store.setStatus("idle")
        store.setStatusDetail("")
        return
      }
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
          // Context full: compact once (keeping the current request) and retry.
          if (isContextOverflow(error) && !compacted) {
            compacted = true
            store.setStatusDetail("compacting…")
            if (await compactHistory(options, true)) continue
          }
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
        const tool = getTool(call.name)
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
        // Post-edit diagnostics: run the project check once and feed failures back.
        if (!ranDiagnostics && modified && config.diagnostics.enabled && store.mode() === "build") {
          const command = diagnosticsCommand(config, options.workspace)
          if (command.length > 0) {
            ranDiagnostics = true
            modified = false
            store.setStatus("tool")
            store.setStatusDetail("checks")
            const { code, output } = await runCommand(command, options.workspace, options.signal)
            if (code !== 0) {
              store.addInfoMessage(`diagnostics · ${command}\n${output.slice(0, 3000)}`)
              history.push({
                role: "user",
                content: `The project check \`${command}\` failed:\n${output.slice(0, 4000)}\nFix the problems, then stop.`,
              })
              continue
            }
            store.showToast(`checks passed · ${command}`, "info")
          }
        }
        store.setStatus("idle")
        store.setStatusDetail("")
        // Ring the terminal bell when a (long) turn finishes.
        if (config.notify && performance.now() - turnStart > 5000) {
          try {
            process.stdout.write("\u0007")
          } catch {
            // ignore
          }
        }
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
// When keepLastUser is set the most recent user message is preserved (used when
// recovering from a context-overflow mid-turn).
export async function compactHistory(options: TurnOptions, keepLastUser = false): Promise<boolean> {
  if (history.length === 0) return false
  const lastUser = keepLastUser ? [...history].reverse().find((message) => message.role === "user") : undefined
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
    store.showToast("compact failed", "error")
    return false
  }

  if (summary.trim().length === 0) {
    store.showToast("compact produced nothing", "warn")
    return false
  }

  resetHistory()
  history.push({ role: "system", content: `Summary of earlier conversation:\n${summary}` })
  if (lastUser) history.push({ role: "user", content: lastUser.content })
  store.addInfoMessage(`compacted conversation:\n${summary}`)
  return true
}
