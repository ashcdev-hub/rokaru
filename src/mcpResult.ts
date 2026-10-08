// When an MCP tool returns an empty payload (no items), say so plainly so the
// model (and you) don't mistake "nothing is open/connected" for a working call.

function isEmptyPayload(value: any): boolean {
  if (Array.isArray(value)) return value.length === 0
  if (value && typeof value === "object") {
    if (typeof value.count === "number" && value.count === 0) return true
    const arrays = Object.values(value).filter(Array.isArray) as unknown[][]
    return arrays.length > 0 && arrays.every((array) => array.length === 0)
  }
  return false
}

export function emptyResultHint(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return text
  try {
    if (!isEmptyPayload(JSON.parse(trimmed))) return text
  } catch {
    return text
  }
  return `${text}\n\n(note: the MCP server returned no items. Nothing is connected or open on its side yet.)`
}
