// Shrink MCP tool schemas without changing behaviour: every tool and every
// argument stays exactly the same; only the human-readable prose is trimmed.
// This is a safe way to cut context because nothing is hidden or renamed.

const MAX_DESCRIPTION_CHARS = 140

// Keep the first sentence (or line) of a tool description.
export function trimDescription(text: string | undefined): string | undefined {
  if (!text) return undefined
  const firstLine = text.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? ""
  if (firstLine.length === 0) return undefined
  const sentence = firstLine.split(/(?<=[.!?])\s+/)[0] ?? firstLine
  const picked = sentence.length > 0 ? sentence : firstLine
  return picked.length > MAX_DESCRIPTION_CHARS ? picked.slice(0, MAX_DESCRIPTION_CHARS - 1).trimEnd() + "…" : picked
}

// Recursively drop JSON-schema `description` fields. Structure (properties,
// types, enums, required, defaults) is preserved verbatim.
export function stripSchemaDescriptions(value: any): any {
  if (Array.isArray(value)) return value.map(stripSchemaDescriptions)
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      if (key === "description") continue
      out[key] = stripSchemaDescriptions(item)
    }
    return out
  }
  return value
}
