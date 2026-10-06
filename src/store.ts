import { createSignal } from "solid-js"
import { EMPTY_METRICS, type TurnMetrics } from "./metrics"
import type { ModelInfo } from "./omlx"

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
    }

export interface UIMessage {
  id: string
  role: "user" | "assistant"
  parts: Part[]
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
export const [showReasoning, setShowReasoning] = createSignal(true)
export const [contextPercent, setContextPercent] = createSignal(0)
export const [promptTokens, setPromptTokens] = createSignal(0)
export const [workspace, setWorkspace] = createSignal("")
export const [switchingModel, setSwitchingModel] = createSignal(false)

export const [toast, setToast] = createSignal<string | undefined>(undefined)
let toastTimer: ReturnType<typeof setTimeout> | undefined

export function showToast(message: string): void {
  setToast(message)
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => setToast(undefined), 1600)
}

export function addUserMessage(text: string): void {
  setMessages((prev) => [...prev, { id: nextId("user"), role: "user", parts: [{ kind: "text", text }] }])
}

export function startAssistantMessage(): string {
  const id = nextId("asst")
  setMessages((prev) => [...prev, { id, role: "assistant", parts: [] }])
  return id
}

export function patchMessage(id: string, fn: (message: UIMessage) => UIMessage): void {
  setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)))
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

export interface PermissionRequest {
  name: string
  args: string
  destructive: boolean
  resolve: (ok: boolean) => void
}

export const [permission, setPermission] = createSignal<PermissionRequest | undefined>(undefined)
export const [permissionChoice, setPermissionChoice] = createSignal(0)

export function requestPermission(name: string, args: string, destructive: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    setStatus("permission")
    setPermissionChoice(0)
    setPermission({ name, args, destructive, resolve })
  })
}

export function movePermissionChoice(delta: number): void {
  setPermissionChoice((current) => Math.max(0, Math.min(1, current + delta)))
}

export function answerPermission(ok: boolean): void {
  const current = permission()
  if (!current) return
  setPermission(undefined)
  setStatus(ok ? "tool" : "idle")
  current.resolve(ok)
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
  setStatus("idle")
  setStatusDetail("")
  setError(undefined)
}
