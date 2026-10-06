// Make plain prose easier to scan by marking up numbers, dates, times and
// measurements so the markdown renderer can colour them (opencode-style).
// Fenced code, inline code and link destinations are left untouched.

const FENCE = /(```[\s\S]*?```)/g
const PROTECTED = /(`[^`]*`|\]\([^)]*\))/g

const NUMERIC = new RegExp(
  [
    "\\$\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?", // $10, $1,299.99
    "\\b\\d{1,2}:\\d{2}(?:\\s?[ap]m)?", // 14:30, 2:30pm
    "\\b\\d{1,2}\\s?[ap]m", // 2pm, 11 am
    "\\b\\d{1,2}\\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*", // 16 Oct
    "\\b\\d+(?:\\.\\d+)?\\s?(?:%|ms|GB|MB|KB|TB|GiB|MiB|fps|px|kg|km|mph|t\\/s|tok\\/s|s\\b)",
    "\\b\\d+(?:\\.\\d+)?[kKmM]\\b", // 3k, 1.5M
  ].join("|"),
  "gi",
)

function decorateProse(segment: string): string {
  return segment
    .split(PROTECTED)
    .map((chunk, index) => (index % 2 === 1 ? chunk : chunk.replace(NUMERIC, "**$&**")))
    .join("")
}

export function decorateAssistant(markdown: string): string {
  return markdown
    .split(FENCE)
    .map((segment, index) => (index % 2 === 1 ? segment : decorateProse(segment)))
    .join("")
}
