import { createSignal } from "solid-js"
import { EMPTY_METRICS, type TurnMetrics } from "./metrics"
import type { ModelInfo } from "./omlx"
import type { Theme } from "./theme"

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
    }

export interface UIMessage {
  id: string
  role: "user" | "assistant" | "info"
  parts: Part[]
  images?: string[]
  thinkingMs?: number
  thinkingExpanded?: boolean
}

export type Status = "idle" | "thinking" | "streaming" | "tool" | "permission" | "error"

let seq = 0
export function nextId(prefix: string): string {
  seq += 1
  return `${prefix}-${seq}`
}

export const [messages, setMessages] = createSignal<UIMessage[]>([])
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
export const [palette, setPalette] = createSignal(false)
export const [paletteIndex, setPaletteIndex] = createSignal(0)
export const [contextPercent, setContextPercent] = createSignal(0)
export const [promptTokens, setPromptTokens] = createSignal(0)
export const [workspace, setWorkspace] = createSignal("")
export const [gitBranch, setGitBranch] = createSignal("")
export const [switchingModel, setSwitchingModel] = createSignal(false)
export const [webEnabled, setWebEnabled] = createSignal(false)

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

export type PermissionDecision = "once" | "always" | "deny"
export const PERMISSION_DECISIONS: PermissionDecision[] = ["once", "always", "deny"]

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

export function resetSession(): void {
  for (const message of messages()) {
    for (const part of message.parts) {
      if (part.kind === "text" || part.kind === "reasoning") part.text = ""
      if (part.kind === "tool") part.result = ""
    }
  }
  setMessages([])
  setMetrics(EMPTY_METRICS)
  setContextPercent(0)
  setPromptTokens(0)
  setAllowedTools([])
  setAllowedCommands([])
  setPendingImages([])
  setTodos([])
  setStatus("idle")
  setStatusDetail("")
  setError(undefined)
}
