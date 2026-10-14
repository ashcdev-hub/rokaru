import type { UIMessage } from "./store"

// Flatten the whole session into a readable plain-text transcript (for ctrl+a).
export function formatTranscript(
  messages: UIMessage[],
  meta: { workspace?: string; model?: string } = {},
): string {
  const lines: string[] = ["# rokaru transcript"]
  if (meta.model) lines.push(`model: ${meta.model}`)
  if (meta.workspace) lines.push(`workspace: ${meta.workspace}`)
  lines.push("")

  for (const message of messages) {
    const header = message.role === "user" ? "## you" : message.role === "assistant" ? "## agent" : "## note"
    lines.push(header)
    for (const part of message.parts) {
      if (part.kind === "text") {
        if (part.text.trim().length > 0) lines.push(part.text.trim())
      } else if (part.kind === "reasoning") {
        if (part.text.trim().length > 0) lines.push("[thinking]", part.text.trim())
      } else if (part.kind === "tool") {
        lines.push(`[tool ${part.name}] ${part.args}`.trimEnd())
        if (part.result.trim().length > 0) lines.push(...part.result.split("\n").map((line) => `  ${line}`))
      }
    }
    lines.push("")
  }

  return `${lines.join("\n").trimEnd()}\n`
}
