/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
import type { Span } from "../syntax"
import { CodeLines } from "./Code"

// Inline: **bold**, *italic*/_italic_, `code`, [label](url), ~~strike~~.
const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g

function inline(text: string): Span[] {
  const theme = getTheme()
  const spans: Span[] = []
  let last = 0
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0
    if (index > last) spans.push({ text: text.slice(last, index), fg: theme.body })
    const tok = match[0]
    if (tok.startsWith("`")) spans.push({ text: tok.slice(1, -1), fg: theme.good })
    else if (tok.startsWith("**")) spans.push({ text: tok.slice(2, -2), fg: theme.warn })
    else if (tok.startsWith("__")) spans.push({ text: tok.slice(2, -2), fg: theme.warn })
    else if (tok.startsWith("~~")) spans.push({ text: tok.slice(2, -2), fg: theme.dim })
    else if (tok.startsWith("[")) {
      const link = tok.match(/\[([^\]]+)\]\(([^)]+)\)/)
      spans.push({ text: link ? link[1] : tok, fg: theme.blue })
    } else spans.push({ text: tok.slice(1, -1), fg: theme.body }) // *italic* / _italic_
    last = index + tok.length
  }
  if (last < text.length) spans.push({ text: text.slice(last), fg: theme.body })
  return spans
}

function stripInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
}

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "code"; lang: string; lines: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "hr" }
  | { kind: "para"; lines: string[] }

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "")
  return trimmed.split("|").map((cell) => cell.trim())
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line)
}

function parseBlocks(md: string): Block[] {
  const lines = md.split("\n")
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length > 0) {
      blocks.push({ kind: "para", lines: para })
      para = []
    }
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    const fence = line.match(/^```(.*)$/)
    if (fence) {
      flush()
      const lang = fence[1].trim()
      const body: string[] = []
      i += 1
      while (i < lines.length && !/^```/.test(lines[i])) {
        body.push(lines[i])
        i += 1
      }
      i += 1
      blocks.push({ kind: "code", lang, lines: body })
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flush()
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] })
      i += 1
      continue
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush()
      blocks.push({ kind: "hr" })
      i += 1
      continue
    }

    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flush()
      const header = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes("|") && lines[i].trim().length > 0) {
        rows.push(splitRow(lines[i]))
        i += 1
      }
      blocks.push({ kind: "table", header, rows })
      continue
    }

    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      flush()
      const body: string[] = [quote[1]]
      i += 1
      while (i < lines.length) {
        const next = lines[i].match(/^>\s?(.*)$/)
        if (!next) break
        body.push(next[1])
        i += 1
      }
      blocks.push({ kind: "quote", lines: body })
      continue
    }

    const li = line.match(/^\s*([-*+]|\d+\.)\s+(.*)$/)
    if (li) {
      flush()
      const items: string[] = [li[2]]
      i += 1
      while (i < lines.length) {
        const next = lines[i].match(/^\s*([-*+]|\d+\.)\s+(.*)$/)
        if (!next) break
        items.push(next[2])
        i += 1
      }
      blocks.push({ kind: "list", items })
      continue
    }

    if (line.trim().length === 0) {
      flush()
      i += 1
      continue
    }

    para.push(line)
    i += 1
  }
  flush()
  return blocks
}

function Spans(props: { spans: Span[] }) {
  return (
    <text fg={getTheme().body}>
      <For each={props.spans}>{(span) => <span {...sg(span.fg)}>{span.text}</span>}</For>
    </text>
  )
}

function TableView(props: { header: string[]; rows: string[][] }) {
  const widths = () =>
    props.header.map((h, c) =>
      Math.min(30, Math.max(stripInline(h).length, ...props.rows.map((r) => stripInline(r[c] ?? "").length), 3)),
    )
  const pad = (text: string, width: number) => {
    const s = stripInline(text)
    return s.length > width ? `${s.slice(0, width - 1)}…` : s.padEnd(width)
  }
  const headerLine = () => props.header.map((h, c) => pad(h, widths()[c])).join(" │ ")
  const separator = () => widths().map((w) => "─".repeat(w)).join("─┼─")
  return (
    <box flexDirection="column">
      <text fg={getTheme().accent}>
        <b>{headerLine()}</b>
      </text>
      <text fg={getTheme().track}>{separator()}</text>
      <For each={props.rows}>
        {(row) => <text fg={getTheme().body}>{props.header.map((_, c) => pad(row[c] ?? "", widths()[c])).join(" │ ")}</text>}
      </For>
    </box>
  )
}

export function Markdown(props: { text: string }) {
  const blocks = parseBlocks(props.text)
  return (
    <box flexDirection="column" width="100%">
      <For each={blocks}>
        {(block) => {
          switch (block.kind) {
            case "heading":
              return (
                <box flexDirection="column" marginBottom={1}>
                  <text fg={block.level <= 2 ? getTheme().accent : getTheme().warn}>
                    <b>{block.text}</b>
                  </text>
                </box>
              )
            case "hr":
              return (
                <box marginBottom={1}>
                  <text fg={getTheme().track}>{"─".repeat(40)}</text>
                </box>
              )
            case "code":
              return (
                <box
                  flexDirection="column"
                  marginBottom={1}
                  backgroundColor={getTheme().panelBg}
                  border
                  borderStyle="rounded"
                  borderColor={getTheme().panelBorder}
                  paddingLeft={1}
                  paddingRight={1}
                >
                  <Show when={block.lang.length > 0}>
                    <text fg={getTheme().dim}>{block.lang}</text>
                  </Show>
                  <CodeLines lines={block.lines} />
                </box>
              )
            case "quote":
              return (
                <box flexDirection="column" marginBottom={1}>
                  <For each={block.lines}>
                    {(line) => (
                      <box flexDirection="row">
                        <text fg={getTheme().accent}>{"│ "}</text>
                        <Spans spans={inline(line).map((s) => ({ ...s, fg: getTheme().dim }))} />
                      </box>
                    )}
                  </For>
                </box>
              )
            case "list":
              return (
                <box flexDirection="column" marginBottom={1}>
                  <For each={block.items}>
                    {(item) => (
                      <box flexDirection="row">
                        <text fg={getTheme().blue}>{"• "}</text>
                        <box flexGrow={1}>
                          <Spans spans={inline(item)} />
                        </box>
                      </box>
                    )}
                  </For>
                </box>
              )
            case "table":
              return (
                <box marginBottom={1}>
                  <TableView header={block.header} rows={block.rows} />
                </box>
              )
            case "para":
              return (
                <box flexDirection="column" marginBottom={1}>
                  <For each={block.lines}>{(line) => <Spans spans={inline(line)} />}</For>
                </box>
              )
          }
        }}
      </For>
    </box>
  )
}
