import type { UIMessage } from "./store"

export interface TurnGroup {
  key: string
  messages: UIMessage[]
}

// Group a window of messages into turns: each user message starts a new turn,
// which runs until the next user message (absorbing assistant/info messages).
export function groupTurns(list: UIMessage[]): TurnGroup[] {
  const groups: TurnGroup[] = []
  for (const message of list) {
    if (message.role === "user" || groups.length === 0) {
      groups.push({ key: message.id, messages: [message] })
    } else {
      groups[groups.length - 1].messages.push(message)
    }
  }
  return groups
}

// A one-line summary for a collapsed turn.
export function turnSummary(messages: UIMessage[], formatDuration: (ms: number) => string): string {
  const hasUser = messages.some((message) => message.role === "user")
  const hasAgent = messages.some((message) => message.role === "assistant")
  const tools = messages.reduce(
    (count, message) => count + message.parts.filter((part) => part.kind === "tool").length,
    0,
  )
  const meta = [...messages].reverse().find((message) => message.role === "assistant" && message.elapsedMs !== undefined)
  const bits: string[] = [`${hasUser ? "you" : "·"} → ${hasAgent ? "agent" : "…"}`]
  if (tools > 0) bits.push(`${tools} tool${tools === 1 ? "" : "s"}`)
  if (meta?.elapsedMs !== undefined) bits.push(formatDuration(meta.elapsedMs))
  if (meta?.tokens) bits.push(`${meta.tokens} tok`)
  return bits.join(" · ")
}
