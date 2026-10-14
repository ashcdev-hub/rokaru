import { createSignal } from "solid-js"
import { EMPTY_METRICS, type TurnMetrics } from "./metrics"
import type { ModelInfo } from "./omlx"
import type { Theme } from "./theme"
import type { Skill } from "./skills"

export type { Skill } from "./skills"

export type Part =
  | { kind: "text"; text: string }
  | { kind: "reasoning"; text: string }
  | {
      kind: "tool"
      id: string
      name: string
      args: string
      status: "pending" | "running" | "ok" | "error" | "denied"
      result: string
      diff?: { kind: "add" | "del" | "ctx"; text: string }[]
      durationMs?: number
      expanded?: boolean
      // True while partial output is still streaming in (e.g. a long bash run).
      live?: boolean
    }

export interface UIMessage {
  id: string
  role: "user" | "assistant" | "info"
  parts: Part[]
  images?: string[]
  thinkingMs?: number
  thinkingExpanded?: boolean
  // Per-turn metadata (wall-clock start, duration, output tokens).
  startedAt?: number
  elapsedMs?: number
  tokens?: number
}

export type StreamKind = "text" | "reasoning"

export interface StreamBuffer {
  messageId: string
  kind: StreamKind
  text: string
}

export type Status = "idle" | "thinking" | "streaming" | "tool" | "permission" | "error"

let seq = 0
export function nextId(prefix: string): string {
  seq += 1
  return `${prefix}-${seq}`
}

export const [messages, setMessages] = createSignal<UIMessage[]>([])
export const [streamBuffer, setStreamBuffer] = createSignal<StreamBuffer | undefined>(undefined)
export const [status, setStatus] = createSignal<Status>("idle")
export const [statusDetail, setStatusDetail] = createSignal("")
export const [metrics, setMetrics] = createSignal<TurnMetrics>(EMPTY_METRICS)
export const [model, setModel] = createSignal("")
export const [models, setModels] = createSignal<ModelInfo[]>([])
export const [modelLimit, setModelLimit] = createSignal(0)
export const [error, setError] = createSignal<string | undefined>(undefined)
export const [showReasoning, setShowReasoning] = createSignal(false)
export const [expandTools, setExpandTools] = createSignal(false)
export const [inputValue, setInputValue] = createSignal("")
export const [menuIndex, setMenuIndex] = createSignal(0)
export const [mentionIndex, setMentionIndex] = createSignal(0)
export const [palette, setPalette] = createSignal(false)
export const [paletteIndex, setPaletteIndex] = createSignal(0)
export const [paletteQuery, setPaletteQuery] = createSignal("")
export const [contextPercent, setContextPercent] = createSignal(0)
export const [promptTokens, setPromptTokens] = createSignal(0)
export const [workspace, setWorkspace] = createSignal("")
export const [gitBranch, setGitBranch] = createSignal("")
export const [switchingModel, setSwitchingModel] = createSignal(false)
export const [webEnabled, setWebEnabled] = createSignal(false)

// Busy status details (rich status bar): when the current turn started, which
// tool round it is on, and how many tools are running right now.
export const [turnStartedAt, setTurnStartedAt] = createSignal(0)
export const [turnRound, setTurnRound] = createSignal(0)
export const [activeTools, setActiveTools] = createSignal(0)

// Wall-clock start of this session (for the sidebar session timer).
export const [sessionStartedAt, setSessionStartedAt] = createSignal(0)

// Per-model output token cap for the current turn (for the progress ETA).
export const [outputLimit, setOutputLimit] = createSignal(0)

// UI preferences resolved from config / environment.
export const [reduceMotion, setReduceMotion] = createSignal(false)
export const [sidebarVisible, setSidebarVisible] = createSignal(true)

// Column width the sidebar occupies; 0 when hidden, so the main panes reflow.
export function sidebarCols(): number {
  return sidebarVisible() ? 34 : 0
}

export type Mode = "build" | "plan"
export const [mode, setMode] = createSignal<Mode>("build")

export type McpStatus = "connected" | "error" | "disabled" | "connecting"

export interface McpServerInfo {
  name: string
  status: McpStatus
  tools: number
  error?: string
}

export const [mcpServers, setMcpServers] = createSignal<McpServerInfo[]>([])
export const [mcpPanel, setMcpPanel] = createSignal(false)
export const [mcpPanelIndex, setMcpPanelIndex] = createSignal(0)

// Skills discovered this session (RAM only, wiped on exit).
export const [skillList, setSkillList] = createSignal<Skill[]>([])
// Skills panel (opened by /skills).
export const [skillPanel, setSkillPanel] = createSignal(false)
export const [skillPanelIndex, setSkillPanelIndex] = createSignal(0)

// Theme selector panel (opened by /themes).
export const [themePanel, setThemePanel] = createSignal(false)
export const [themeIndex, setThemeIndex] = createSignal(0)
// Custom-theme editor state (inside the panel).
export const [themeCustom, setThemeCustom] = createSignal(false)
export const [themeCustomRole, setThemeCustomRole] = createSignal(0)
export const [themeDraft, setThemeDraft] = createSignal<Theme | undefined>(undefined)

export interface TodoItem {
  content: string
  status: "pending" | "in_progress" | "completed"
}

export const [todos, setTodos] = createSignal<TodoItem[]>([])

export type ToastKind = "info" | "success" | "warn" | "error"

export interface Toast {
  message: string
  kind: ToastKind
}

export const [toast, setToast] = createSignal<Toast | undefined>(undefined)
let toastTimer: ReturnType<typeof setTimeout> | undefined

export function showToast(message: string, kind: ToastKind = "success"): void {
  setToast({ message, kind })
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => setToast(undefined), kind === "error" ? 3200 : 1700)
}

export interface PendingImage {
  name: string
  dataUrl: string
}

export const [pendingImages, setPendingImages] = createSignal<PendingImage[]>([])

export function addPendingImage(image: PendingImage): void {
  setPendingImages((prev) => [...prev, image])
}

export function removePendingImage(index: number): void {
  setPendingImages((prev) => prev.filter((_, i) => i !== index))
}

export function clearPendingImages(): void {
  setPendingImages([])
}

export interface FindNav {
  query: string
  hits: number[]
  at: number
}

export const [findNav, setFindNav] = createSignal<FindNav | undefined>(undefined)

export function clearFindNav(): void {
  setFindNav(undefined)
}

// A generic yes/no confirmation, used before destructive session actions like
// /clear and /new (RAM-only sessions can't be recovered).
export interface ConfirmRequest {
  message: string
  confirmLabel: string
  resolve: (ok: boolean) => void
}

export const [confirmRequest, setConfirmRequest] = createSignal<ConfirmRequest | undefined>(undefined)

export function requestConfirm(message: string, confirmLabel = "confirm"): Promise<boolean> {
  return new Promise((resolve) => {
    setConfirmRequest({ message, confirmLabel, resolve })
  })
}

export function answerConfirm(ok: boolean): void {
  const current = confirmRequest()
  if (!current) return
  setConfirmRequest(undefined)
  current.resolve(ok)
}

// Interrupt chooser shown when esc is pressed while the model is working.
export const INTERRUPT_OPTIONS = ["stop now", "finish current tool, then stop", "continue (cancel)"] as const
export const [interruptMenu, setInterruptMenu] = createSignal(false)
export const [interruptIndex, setInterruptIndex] = createSignal(0)

export function moveInterruptIndex(delta: number): void {
  setInterruptIndex((current) => Math.max(0, Math.min(INTERRUPT_OPTIONS.length - 1, current + delta)))
}

// "Changes this session" panel (built from the undo snapshots).
export interface ChangeEntry {
  path: string
  edits: number
}

export const [changesPanel, setChangesPanel] = createSignal(false)
export const [changesIndex, setChangesIndex] = createSignal(0)
export const [changesList, setChangesList] = createSignal<ChangeEntry[]>([])

// Per-tool cancellation. The agent registers a handler per running tool call;
// the transcript's running panel (and the cancel key) can invoke it without
// aborting the whole turn.
const toolCancelHandlers = new Map<string, () => void>()

export function registerToolCancel(id: string, fn: () => void): void {
  toolCancelHandlers.set(id, fn)
}

export function unregisterToolCancel(id: string): void {
  toolCancelHandlers.delete(id)
}

export function cancelTool(id: string): boolean {
  const fn = toolCancelHandlers.get(id)
  if (!fn) return false
  fn()
  return true
}

export function cancelAllTools(): void {
  for (const fn of [...toolCancelHandlers.values()]) fn()
}

export function lastRunningToolId(): string | undefined {
  const ids = [...toolCancelHandlers.keys()]
  return ids[ids.length - 1]
}

export function messageSearchText(message: UIMessage): string {
  return message.parts
    .map((part) =>
      part.kind === "text" || part.kind === "reasoning"
        ? part.text
        : part.kind === "tool"
          ? `${part.name} ${part.args} ${part.result}`
          : "",
    )
    .join("\n")
}

export function findMessageHits(query: string): number[] {
  const needle = query.toLowerCase()
  if (needle.length === 0) return []
  const hits: number[] = []
  messages().forEach((message, index) => {
    if (messageSearchText(message).toLowerCase().includes(needle)) hits.push(index)
  })
  return hits
}

// Large pastes are collapsed to a "Pasted N lines" attachment row instead of
// going into the textarea, so the prompt box stays compact. The full text is
// folded into the message on submit.
export const [pastedText, setPastedText] = createSignal("")

export function pastedLineCount(): number {
  const text = pastedText()
  if (text.length === 0) return 0
  return text.split("\n").length
}

export function clearPastedText(): void {
  setPastedText("")
}

export function addUserMessage(text: string, images?: string[]): void {
  setMessages((prev) => [...prev, { id: nextId("user"), role: "user", parts: [{ kind: "text", text }], images }])
}

export function addInfoMessage(text: string): void {
  setMessages((prev) => [...prev, { id: nextId("info"), role: "info", parts: [{ kind: "text", text }] }])
}

export function startAssistantMessage(): string {
  const id = nextId("asst")
  setMessages((prev) => [...prev, { id, role: "assistant", parts: [] }])
  return id
}

// Remove the most recent user message and everything after it. Used by retry to
// re-run the last turn cleanly before the fresh turn is appended.
export function dropFromLastUserMessage(): boolean {
  const list = messages()
  let index = -1
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].role === "user") {
      index = i
      break
    }
  }
  if (index === -1) return false
  setMessages(list.slice(0, index))
  clearFindNav()
  return true
}

export function patchMessage(id: string, fn: (message: UIMessage) => UIMessage): void {
  setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)))
}

export function setMessageThinking(id: string, seconds: number): void {
  patchMessage(id, (m) => ({ ...m, thinkingMs: seconds }))
}

export function toggleThinking(id: string): void {
  patchMessage(id, (m) => ({ ...m, thinkingExpanded: !m.thinkingExpanded }))
}

export function thinkingVisible(message: UIMessage): boolean {
  return Boolean(message.thinkingExpanded) || showReasoning()
}

export function appendText(id: string, kind: "text" | "reasoning", text: string): void {
  patchMessage(id, (m) => {
    const parts = [...m.parts]
    const last = parts[parts.length - 1]
    if (last && last.kind === kind) {
      parts[parts.length - 1] = { kind, text: last.text + text }
    } else {
      parts.push({ kind, text })
    }
    return { ...m, parts }
  })
}

// Streaming tokens land in a small buffer instead of rebuilding the transcript
// on every flush. It is folded into the message parts at segment boundaries.
export function appendStream(messageId: string, kind: StreamKind, text: string): void {
  const buffer = streamBuffer()
  if (buffer && buffer.messageId === messageId && buffer.kind === kind) {
    setStreamBuffer({ ...buffer, text: buffer.text + text })
    return
  }
  commitStream()
  setStreamBuffer({ messageId, kind, text })
}

export function commitStream(): void {
  const buffer = streamBuffer()
  if (!buffer) return
  setStreamBuffer(undefined)
  if (buffer.text.length > 0) appendText(buffer.messageId, buffer.kind, buffer.text)
}

export function addToolPart(id: string, toolId: string, name: string, args: string): void {
  patchMessage(id, (m) => ({
    ...m,
    parts: [...m.parts, { kind: "tool", id: toolId, name, args, status: "pending", result: "" }],
  }))
}

export function updateToolPart(
  id: string,
  toolId: string,
  patch: Partial<Extract<Part, { kind: "tool" }>>,
): void {
  patchMessage(id, (m) => ({
    ...m,
    parts: m.parts.map((p) => (p.kind === "tool" && p.id === toolId ? { ...p, ...patch } : p)),
  }))
}

export function toggleToolExpanded(messageId: string, toolId: string): void {
  patchMessage(messageId, (m) => ({
    ...m,
    parts: m.parts.map((p) => (p.kind === "tool" && p.id === toolId ? { ...p, expanded: !p.expanded } : p)),
  }))
}

// Stream a running tool's partial output into its panel (capped) without
// waiting for it to finish.
const LIVE_OUTPUT_CAP = 40_000

export function appendToolOutput(messageId: string, toolId: string, chunk: string): void {
  if (chunk.length === 0) return
  patchMessage(messageId, (m) => ({
    ...m,
    parts: m.parts.map((p) => {
      if (p.kind !== "tool" || p.id !== toolId) return p
      const next = p.result.length >= LIVE_OUTPUT_CAP ? p.result : (p.result + chunk).slice(0, LIVE_OUTPUT_CAP)
      return { ...p, result: next, live: true }
    }),
  }))
}

// Per-turn metadata shown under an agent message.
export function setMessageMeta(id: string, patch: { startedAt?: number; elapsedMs?: number; tokens?: number }): void {
  patchMessage(id, (m) => ({ ...m, ...patch }))
}

export type PermissionDecision = "once" | "always" | "all" | "deny"
export const PERMISSION_DECISIONS: PermissionDecision[] = ["once", "always", "all", "deny"]

export interface PermissionRequest {
  name: string
  args: string
  destructive: boolean
  resolve: (decision: PermissionDecision) => void
}

export const [permission, setPermission] = createSignal<PermissionRequest | undefined>(undefined)
export const [permissionChoice, setPermissionChoice] = createSignal(0)
// Tools the user chose "always allow" for, for this session only (RAM, wiped on
// exit). Never persisted.
export const [allowedTools, setAllowedTools] = createSignal<string[]>([])
// Leading command words auto-allowed for bash (e.g. "git"), session-only.
export const [allowedCommands, setAllowedCommands] = createSignal<string[]>([])
// Session-wide "allow all tools" switch, toggled with /allow-all.
export const [autoApprove, setAutoApprove] = createSignal(false)

export function isToolAllowed(name: string): boolean {
  return allowedTools().includes(name)
}

export function allowTool(name: string): void {
  setAllowedTools((prev) => (prev.includes(name) ? prev : [...prev, name]))
}

export function isCommandAllowed(prefix: string): boolean {
  return prefix.length > 0 && allowedCommands().includes(prefix)
}

export function allowCommand(prefix: string): void {
  setAllowedCommands((prev) => (prev.includes(prefix) ? prev : [...prev, prefix]))
}

export function requestPermission(name: string, args: string, destructive: boolean): Promise<PermissionDecision> {
  return new Promise((resolve) => {
    setStatus("permission")
    setPermissionChoice(0)
    setPermission({ name, args, destructive, resolve })
  })
}

export function movePermissionChoice(delta: number): void {
  setPermissionChoice((current) => Math.max(0, Math.min(PERMISSION_DECISIONS.length - 1, current + delta)))
}

export function answerPermission(decision: PermissionDecision): void {
  const current = permission()
  if (!current) return
  setPermission(undefined)
  setStatus(decision === "deny" ? "idle" : "tool")
  current.resolve(decision)
}

export interface QuestionOption {
  label: string
  description?: string
}

export type QuestionAnswer =
  | { kind: "option"; index: number; label: string }
  | { kind: "custom"; text: string }
  | { kind: "dismissed" }

export interface QuestionRequest {
  toolCallId: string
  question: string
  options: QuestionOption[]
  resolve: (answer: QuestionAnswer) => void
}

export const [question, setQuestion] = createSignal<QuestionRequest | undefined>(undefined)
export const [questionIndex, setQuestionIndex] = createSignal(0)
export const [questionTyping, setQuestionTyping] = createSignal(false)

export function questionRowCount(): number {
  const pending = question()
  if (!pending) return 0
  return pending.options.length + 1
}

export function requestQuestion(toolCallId: string, questionText: string, options: QuestionOption[]): Promise<QuestionAnswer> {
  return new Promise((resolve) => {
    setStatus("tool")
    setQuestionIndex(0)
    setQuestionTyping(false)
    setQuestion({ toolCallId, question: questionText, options, resolve })
  })
}

export function moveQuestionIndex(delta: number): void {
  setQuestionIndex((current) => Math.max(0, Math.min(questionRowCount() - 1, current + delta)))
}

export function answerQuestion(answer: QuestionAnswer): void {
  const current = question()
  if (!current) return
  setQuestion(undefined)
  setQuestionTyping(false)
  setStatus("tool")
  current.resolve(answer)
}

export function selectQuestionRow(row: number): void {
  const pending = question()
  if (!pending) return
  if (row < pending.options.length) {
    const label = pending.options[row]?.label ?? ""
    answerQuestion({ kind: "option", index: row, label })
  } else if (row === pending.options.length) {
    setQuestionTyping(true)
  }
}

export const [inputPrefill, setInputPrefill] = createSignal("")

export function consumeInputPrefill(): string {
  const text = inputPrefill()
  if (text.length > 0) setInputPrefill("")
  return text
}

export function resetSession(): void {
  for (const message of messages()) {
    for (const part of message.parts) {
      if (part.kind === "text" || part.kind === "reasoning") part.text = ""
      if (part.kind === "tool") part.result = ""
    }
  }
  setMessages([])
  setStreamBuffer(undefined)
  setPermission(undefined)
  setQuestion(undefined)
  setQuestionTyping(false)
  setConfirmRequest(undefined)
  setInterruptMenu(false)
  setChangesPanel(false)
  setChangesList([])
  setInputPrefill("")
  setFindNav(undefined)
  setPalette(false)
  setPaletteQuery("")
  setMetrics(EMPTY_METRICS)
  setContextPercent(0)
  setPromptTokens(0)
  setTurnStartedAt(0)
  setTurnRound(0)
  setActiveTools(0)
  setAllowedTools([])
  setAllowedCommands([])
  setAutoApprove(false)
  setPendingImages([])
  setPastedText("")
  setTodos([])
  setStatus("idle")
  setStatusDetail("")
  setError(undefined)
}
