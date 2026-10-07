import { getTheme } from "./theme"

export interface Span {
  text: string
  fg: string
}

const KEYWORDS =
  /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|new|async|await|try|catch|finally|throw|type|interface|extends|implements|def|elif|end|do|then|fi|in|of|this|self|True|False|None|null|true|false|public|private|static|void|struct|enum|match|use|pub|fn|impl)\b/
const CODE_TOKEN = new RegExp(
  [
    "(\\/\\/[^\\n]*|#[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)",
    "(\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`)",
    "\\b(\\d+(?:\\.\\d+)?)\\b",
    KEYWORDS.source,
  ].join("|"),
  "g",
)

// A lightweight, regex-based syntax highlighter (comments, strings, numbers,
// keywords). Not tree-sitter, but enough to make code readable.
export function highlightLine(line: string): Span[] {
  const theme = getTheme()
  const spans: Span[] = []
  let last = 0
  for (const match of line.matchAll(CODE_TOKEN)) {
    const index = match.index ?? 0
    if (index > last) spans.push({ text: line.slice(last, index), fg: theme.body })
    const [full, comment, str, num] = match
    const fg = comment ? theme.dim : str ? theme.good : num ? theme.warn : theme.blue
    spans.push({ text: full, fg })
    last = index + full.length
  }
  if (last < line.length) spans.push({ text: line.slice(last), fg: theme.body })
  return spans.length > 0 ? spans : [{ text: line, fg: theme.body }]
}
