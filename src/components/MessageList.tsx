/** @jsxImportSource @opentui/solid */
import { For, Index, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import type { ScrollBoxRenderable } from "@opentui/core"
import { getTheme, sg } from "../theme"
import { Markdown } from "./Markdown"
import { DiffView } from "./Code"
import { FadeIn, Spinner } from "./anim"
import { decorateAssistant } from "../highlight"
import { getTool } from "../tools"
import { copyToClipboard } from "../clipboard"
import { Pill } from "./ui"
import {
  expandTools,
  findNav,
  messages,
  showToast,
  sidebarCols,
  status,
  streamBuffer,
  thinkingVisible,
  todos,
  toggleThinking,
  toggleToolExpanded,
  workspace,
} from "../store"
import type { Part, StreamKind, UIMessage } from "../store"
import { transcriptWindow } from "../transcriptWindow"

const COLLAPSE_LINES = 10
// Tool results are frequently one enormous line (a JSON blob from an MCP log or
// list call). Line-count alone never collapses those, so also bound the visible
// character budget to roughly what ten wrapped rows can show.
const COLLAPSE_CHARS = 800

let transcriptBox: ScrollBoxRenderable | undefined

export function scrollTranscriptToMessage(index: number): number {
  const box = transcriptBox
  if (!box) return -1
  // The <Show> empty-state leaves a zero-size slot node behind, so skip
  // non-rendered nodes instead of assuming a 1:1 child mapping.
  const rows = box.getChildren().filter((child) => {
    try {
      return child.getLayoutNode().getComputedHeight() > 0
    } catch {
      return false
    }
  })
  if (rows.length === 0) return -1
  const child = rows[Math.max(0, Math.min(index, rows.length - 1))]
  if (!child) return -1
  let top = 0
  try {
    top = child.getLayoutNode().getComputedTop()
  } catch {
    return -1
  }
  box.scrollTop = Math.max(0, top - 2)
  return box.scrollTop
}

export function scrollTranscriptToBottom(): void {
  const box = transcriptBox
  if (!box) return
  box.scrollTop = Math.max(0, box.scrollHeight)
}

// Keyboard scrolling for the transcript (mouse wheel otherwise).
export function scrollTranscriptBy(lines: number): void {
  transcriptBox?.scrollBy(lines, "absolute")
}

export function scrollTranscriptPage(direction: number): void {
  transcriptBox?.scrollBy(direction * 0.9, "viewport")
}

export function scrollTranscriptToTop(): void {
  if (transcriptBox) transcriptBox.scrollTop = 0
}

function collapse(text: string, max: number, expanded: boolean): string {
  if (expanded) return text
  const lines = text.split("\n")
  const lineClipped = lines.length > max
  let shown = lines.slice(0, max).join("\n")
  const charClipped = shown.length > COLLAPSE_CHARS
  if (charClipped) shown = shown.slice(0, COLLAPSE_CHARS)
  if (!lineClipped && !charClipped) return text
  const hiddenChars = Math.max(0, text.length - shown.length)
  const reason = lineClipped && !charClipped ? `${lines.length - max} more lines` : `${hiddenChars} more chars`
  return `${shown}… (${reason} · click to expand)`
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
}

function statusColour(s: Extract<Part, { kind: "tool" }>["status"]): string {
  switch (s) {
    case "ok":
      return getTheme().panelBorder
    case "error":
      return getTheme().bad
    case "denied":
      return getTheme().warn
    case "running":
      return getTheme().accent
    default:
      return getTheme().panelBorder
  }
}

function parseArgs(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

// Icon + colour by tool category, so panels are scannable at a glance.
function toolHeader(name: string, argsRaw: string): { lead: string; text: string; colour: string } {
  const args = parseArgs(argsRaw)
  if (name.startsWith("mcp__")) return { lead: "⚙", text: name.replace(/^mcp__/, "").replace("__", " · "), colour: getTheme().meter }
  switch (name) {
    case "read_file":
      return { lead: "→", text: `Read ${args.path ?? ""}`, colour: getTheme().blue }
    case "list_dir":
      return { lead: "→", text: `List ${args.path ?? "."}`, colour: getTheme().blue }
    case "glob":
      return { lead: "→", text: `Glob ${args.pattern ?? ""}`, colour: getTheme().blue }
    case "grep":
      return { lead: "→", text: `Grep ${args.pattern ?? ""}`, colour: getTheme().blue }
    case "view_image":
      return { lead: "▣", text: `View ${args.path ?? ""}`, colour: getTheme().meter }
    case "write_file":
      return { lead: "✎", text: `Write ${args.path ?? ""}`, colour: getTheme().accent }
    case "edit_file":
      return { lead: "✎", text: `Edit ${args.path ?? ""}`, colour: getTheme().accent }
    case "bash":
      return { lead: "$", text: args.command ?? argsRaw, colour: getTheme().good }
    case "web_search":
      return { lead: "⌕", text: `Search ${args.query ?? ""}`, colour: getTheme().meter }
    case "web_fetch":
      return { lead: "⌕", text: `Fetch ${args.url ?? ""}`, colour: getTheme().meter }
    case "question":
      return { lead: "?", text: args.question ?? "Question", colour: getTheme().accent }
    default:
      return { lead: "⚙", text: name, colour: getTheme().tool }
  }
}

function AssistantText(props: { text: string; streaming: boolean }) {
  return (
    <Show when={!props.streaming} fallback={<text fg={getTheme().body}>{props.text}</text>}>
      <Markdown text={decorateAssistant(props.text)} />
    </Show>
  )
}

// Read/search tools that can be collapsed into a single transcript row when
// they run back-to-back. Mutating tools, and the interactive ones (question,
// todo_write) are always shown on their own.
const GROUPABLE_TOOLS = new Set([
  "read_file",
  "list_dir",
  "glob",
  "grep",
  "view_image",
  "web_search",
  "web_fetch",
])

function isGroupableTool(part: Part): part is Extract<Part, { kind: "tool" }> {
  if (part.kind !== "tool") return false
  if (GROUPABLE_TOOLS.has(part.name)) return true
  if (part.name.startsWith("mcp__")) {
    const tool = getTool(part.name)
    return tool !== undefined && !tool.destructive
  }
  return false
}

type RenderItem = { kind: "part"; part: Part } | { kind: "group"; parts: Extract<Part, { kind: "tool" }>[] }

// Collapse consecutive read-only tool calls into one group so a turn that reads
// eight files doesn't render eight bordered panels.
function groupParts(parts: Part[]): RenderItem[] {
  const items: RenderItem[] = []
  let run: Extract<Part, { kind: "tool" }>[] = []
  const flush = () => {
    if (run.length === 0) return
    if (run.length === 1) items.push({ kind: "part", part: run[0] })
    else items.push({ kind: "group", parts: run })
    run = []
  }
  for (const part of parts) {
    if (isGroupableTool(part)) {
      run.push(part)
    } else {
      flush()
      items.push({ kind: "part", part })
    }
  }
  flush()
  return items
}

// The plain text of a message, for click-to-copy and search highlighting.
function messageText(message: UIMessage): string {
  return message.parts
    .map((part) =>
      part.kind === "text" || part.kind === "reasoning"
        ? part.text
        : part.kind === "tool"
          ? part.result
          : "",
    )
    .join("\n")
    .trim()
}

// Renders text with occurrences of the active /find query highlighted.
function HighlightText(props: { text: string; fg: string; italic?: boolean }) {
  const query = () => findNav()?.query?.trim() ?? ""
  const pieces = () => {
    const q = query()
    if (q.length === 0) return [{ text: props.text, hit: false }]
    const haystack = props.text.toLowerCase()
    const needle = q.toLowerCase()
    const out: { text: string; hit: boolean }[] = []
    let from = 0
    while (from < props.text.length) {
      const at = haystack.indexOf(needle, from)
      if (at === -1) {
        out.push({ text: props.text.slice(from), hit: false })
        break
      }
      if (at > from) out.push({ text: props.text.slice(from, at), hit: false })
      out.push({ text: props.text.slice(at, at + q.length), hit: true })
      from = at + q.length
    }
    return out
  }
  return (
    <text fg={props.fg}>
      <Show when={props.italic} fallback={
        <For each={pieces()}>
          {(piece) => <span {...sg(piece.hit ? getTheme().background : props.fg, piece.hit ? getTheme().warn : undefined)}>{piece.hit ? <b>{piece.text}</b> : piece.text}</span>}
        </For>
      }>
        <i>
          <For each={pieces()}>
            {(piece) => <span {...sg(piece.hit ? getTheme().background : props.fg, piece.hit ? getTheme().warn : undefined)}>{piece.hit ? <b>{piece.text}</b> : piece.text}</span>}
          </For>
        </i>
      </Show>
    </text>
  )
}

function StreamingCursor() {
  const [on, setOn] = createSignal(true)
  onMount(() => {
    const id = setInterval(() => setOn((v) => !v), 480)
    onCleanup(() => clearInterval(id))
  })
  return <text fg={getTheme().accent}>{on() ? "▌" : " "}</text>
}

function ToolView(props: { message: UIMessage; part: Extract<Part, { kind: "tool" }> }) {
  const part = props.part
  const header = () => toolHeader(part.name, part.args)
  const expanded = () => Boolean(part.expanded) || expandTools()

  // The question header already restates the question, so the stored `Q: …`
  // result line would duplicate it; show just the answer in the transcript.
  const result = () => {
    if (part.name === "question" && part.result.startsWith("Q: ")) {
      const newline = part.result.indexOf("\n")
      if (newline >= 0) return part.result.slice(newline + 1).trimStart()
    }
    return part.result
  }

  if (part.name === "todo_write") {
    return (
      <box
        flexDirection="column"
        marginTop={1}
        border
        borderStyle="rounded"
        borderColor={getTheme().panelBorder}
        backgroundColor={getTheme().panelBg}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={getTheme().dim}>{`todos (${todos().filter((t) => t.status === "completed").length}/${todos().length})`}</text>
        <For each={todos()}>
          {(todo) => (
            <text fg={todo.status === "completed" ? getTheme().dim : todo.status === "in_progress" ? getTheme().accent : getTheme().text}>
              {`${todo.status === "completed" ? "☑" : todo.status === "in_progress" ? "▶" : "☐"} ${todo.content}`}
            </text>
          )}
        </For>
      </box>
    )
  }

  const suffix = () => {
    const bits: string[] = []
    if (part.status === "error") bits.push("failed")
    else if (part.status === "denied") bits.push("denied")
    if (part.durationMs !== undefined && part.status !== "denied" && part.status !== "running") {
      bits.push(formatDuration(part.durationMs))
    }
    if (part.status === "running") bits.push("ctrl+x cancel")
    return bits.length > 0 ? `  ${bits.join(" · ")}` : ""
  }

  const canExpand = () => (part.diff?.length ?? 0) > 0 || result().length > 0

  // While a tool is streaming its output (e.g. a long bash run), show the tail
  // so the newest lines are visible; otherwise collapse the head as before.
  const visibleResult = () => {
    const text = result()
    if (part.status === "running" && part.live) {
      const lines = text.split("\n")
      return lines.length > COLLAPSE_LINES ? `…\n${lines.slice(-COLLAPSE_LINES).join("\n")}` : text
    }
    return collapse(text, COLLAPSE_LINES, expanded())
  }

  return (
    <box
      flexDirection="column"
      marginTop={1}
      border
      borderStyle="rounded"
      borderColor={statusColour(part.status)}
      backgroundColor={getTheme().panelBg}
      paddingLeft={1}
      paddingRight={1}
      onMouseDown={() => toggleToolExpanded(props.message.id, part.id)}
    >
      <box flexDirection="row">
        <Show when={canExpand()}>
          <text fg={getTheme().dim}>{expanded() ? "▾ " : "▸ "}</text>
        </Show>
        <Show
          when={part.status === "running"}
          fallback={<text fg={header().colour}>{`${header().lead}  `}</text>}
        >
          <Spinner fg={header().colour} />
          <text fg={header().colour}>{"  "}</text>
        </Show>
        <text fg={getTheme().text}>{header().text}</text>
        <text fg={part.status === "error" ? getTheme().bad : getTheme().dim}>{suffix()}</text>
      </box>
      <Show
        when={part.diff && part.diff.length > 0}
        fallback={
          <Show when={result().length > 0}>
            <HighlightText
              text={visibleResult()}
              fg={part.status === "error" || part.status === "denied" ? getTheme().bad : getTheme().dim}
            />
          </Show>
        }
      >
        <DiffView lines={part.diff!} />
      </Show>
    </box>
  )
}

function ToolGroupView(props: { message: UIMessage; parts: Extract<Part, { kind: "tool" }>[] }) {
  const first = () => props.parts[0]
  const expanded = () => Boolean(first().expanded) || expandTools()
  const running = () => props.parts.some((part) => part.status === "running")
  const errored = () => props.parts.some((part) => part.status === "error")
  const summary = () => {
    const labels = props.parts.map((part) => toolHeader(part.name, part.args).text)
    const shown = labels.slice(0, 3).join(" · ")
    return labels.length > 3 ? `${shown} +${labels.length - 3}` : shown
  }
  const borderColour = () =>
    errored() ? getTheme().bad : running() ? getTheme().accent : getTheme().panelBorder
  return (
    <box
      flexDirection="column"
      marginTop={1}
      border
      borderStyle="rounded"
      borderColor={borderColour()}
      backgroundColor={getTheme().panelBg}
      paddingLeft={1}
      paddingRight={1}
      onMouseDown={() => toggleToolExpanded(props.message.id, first().id)}
    >
      <box flexDirection="row">
        <text fg={getTheme().dim}>{expanded() ? "▾ " : "▸ "}</text>
        <Show when={running()} fallback={<text fg={getTheme().blue}>{"→  "}</text>}>
          <Spinner fg={getTheme().blue} />
          <text fg={getTheme().blue}>{"  "}</text>
        </Show>
        <text fg={getTheme().text}>{`${props.parts.length} read-only calls`}</text>
        <text fg={getTheme().dim}>{`  ${summary()}`}</text>
      </box>
      <Show when={expanded()}>
        <box flexDirection="column">
          <For each={props.parts}>{(part) => <ToolView message={props.message} part={part} />}</For>
        </box>
      </Show>
    </box>
  )
}

function ThoughtView(props: { message: UIMessage; text: string }) {
  const expanded = () => thinkingVisible(props.message)
  const label = () => {
    const ms = props.message.thinkingMs
    return ms !== undefined ? `Thought: ${ms.toFixed(1)}s` : "Thinking…"
  }
  return (
    <box
      flexDirection="column"
      marginTop={1}
      border={["left"]}
      borderStyle="rounded"
      borderColor={getTheme().warn}
      backgroundColor={getTheme().panelBg}
      paddingLeft={1}
      paddingRight={1}
      onMouseDown={() => toggleThinking(props.message.id)}
    >
      <text fg={getTheme().warn}>
        <span {...sg(getTheme().warn)}>{`${expanded() ? "▾" : "▸"} 🧠 ${label()}`}</span>
      </text>
      <Show when={expanded()}>
        <HighlightText text={props.text} fg={getTheme().dim} italic />
      </Show>
    </box>
  )
}

function PartView(props: { message: UIMessage; part: Part; streaming: boolean }) {
  const part = props.part
  if (part.kind === "text") {
    return <AssistantText text={part.text} streaming={props.streaming} />
  }
  if (part.kind === "reasoning") {
    return <ThoughtView message={props.message} text={part.text} />
  }
  return <ToolView message={props.message} part={part} />
}

function StreamingPart(props: { message: UIMessage; kind: StreamKind; text: string }) {
  if (props.kind === "text") {
    return <AssistantText text={props.text} streaming={true} />
  }
  return <ThoughtView message={props.message} text={props.text} />
}

function Separator() {
  const dims = useTerminalDimensions()
  const width = () => Math.max(10, (dims()?.width ?? 80) - sidebarCols() - 4)
  return <text fg={getTheme().panelBorder}>{"━".repeat(width())}</text>
}

function copyMessage(message: UIMessage): void {
  const text = messageText(message)
  if (text.length === 0) return
  copyToClipboard(text)
  showToast(message.role === "user" ? "copied your message" : "copied the reply")
}

function TurnMeta(props: { message: UIMessage }) {
  const label = () => {
    const at = props.message.startedAt
    const time = at ? new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""
    const parts: string[] = []
    if (time) parts.push(time)
    if (props.message.elapsedMs !== undefined) parts.push(formatDuration(props.message.elapsedMs))
    if (props.message.tokens !== undefined && props.message.tokens > 0) parts.push(`${props.message.tokens} tok`)
    return parts.join(" · ")
  }
  return (
    <Show when={label().length > 0}>
      <text fg={getTheme().dim}>{label()}</text>
    </Show>
  )
}

function MessageView(props: { message: UIMessage; streaming: boolean; first: boolean }) {
  const items = createMemo(() => groupParts(props.message.parts))
  return (
    <FadeIn>
      <Show
        when={props.message.role !== "info"}
        fallback={
          <box flexDirection="column" marginBottom={1} paddingLeft={1}>
            <For each={props.message.parts}>
              {(part) => <HighlightText text={part.kind === "text" ? part.text : ""} fg={getTheme().dim} />}
            </For>
          </box>
        }
      >
        <Show when={props.message.role === "user" && !props.first}>
          <box flexDirection="column" marginTop={1}>
            <Separator />
          </box>
        </Show>
        <box
          flexDirection="column"
          marginBottom={1}
          border={["left"]}
          borderStyle="rounded"
          borderColor={props.message.role === "user" ? getTheme().accent : getTheme().blue}
          backgroundColor={props.message.role === "user" ? getTheme().panelBg : undefined}
          paddingLeft={1}
          paddingRight={props.message.role === "user" ? 1 : 0}
          paddingTop={props.message.role === "user" ? 1 : 0}
          paddingBottom={props.message.role === "user" ? 1 : 0}
        >
          <box flexDirection="row" onMouseDown={() => copyMessage(props.message)}>
            <Pill
              label={props.message.role === "user" ? "you" : "agent"}
              glyph={props.message.role === "user" ? "›" : "✦"}
              fg={getTheme().background}
              bg={props.message.role === "user" ? getTheme().accent : getTheme().blue}
            />
          </box>
          <box flexDirection="column" paddingLeft={1}>
            <For each={items()}>
              {(item) =>
                item.kind === "group" ? (
                  <ToolGroupView message={props.message} parts={item.parts} />
                ) : (
                  <PartView message={props.message} part={item.part} streaming={props.streaming} />
                )
              }
            </For>
            <Show when={streamBuffer()?.messageId === props.message.id ? streamBuffer() : undefined}>
              {(buffer) => <StreamingPart message={props.message} kind={buffer().kind} text={buffer().text} />}
            </Show>
            <Show when={props.message.images && props.message.images.length > 0}>
              <text fg={getTheme().dim}>{`📎 ${props.message.images!.join("  ")}`}</text>
            </Show>
            <Show when={props.streaming}>
              <StreamingCursor />
            </Show>
            <Show when={props.message.role === "assistant" && !props.streaming}>
              <TurnMeta message={props.message} />
            </Show>
          </box>
        </box>
      </Show>
    </FadeIn>
  )
}

function EmptyState() {
  return (
    <box flexDirection="column" paddingLeft={2} paddingTop={1} alignItems="flex-start">
      <text fg={getTheme().blue}>
        <b>ready</b>
      </text>
      <text fg={getTheme().dim}>type a message and press enter</text>
      <text fg={getTheme().dim}>/ for commands · ctrl+p palette · tab plan/build</text>
      <text fg={getTheme().dim}>pgup/pgdn scroll · click you/agent to copy · click a code block to copy</text>
      <text fg={getTheme().dim}>{`workspace · ${workspace() || "?"}`}</text>
    </box>
  )
}

// Only the most recent messages are mounted; the rest stay in the store and are
// available again during /find or after /compact. Keeps very long sessions
// smooth without re-rendering the whole transcript on every token.
const RENDER_WINDOW = 200

export function MessageList() {
  const streamingId = () => {
    const list = messages()
    const last = list[list.length - 1]
    if (!last || last.role !== "assistant") return undefined
    const s = status()
    return s === "streaming" || s === "thinking" || s === "tool" ? last.id : undefined
  }

  const windowed = createMemo(() => transcriptWindow(messages(), RENDER_WINDOW, Boolean(findNav())))

  return (
    <scrollbox
      ref={(el: ScrollBoxRenderable) => (transcriptBox = el)}
      flexGrow={1}
      stickyScroll={true}
      stickyStart="bottom"
      paddingLeft={1}
      paddingRight={1}
    >
      <Show when={messages().length === 0}>
        <EmptyState />
      </Show>
      <Show when={windowed().hidden > 0}>
        <text fg={getTheme().dim}>
          {`… ${windowed().hidden} earlier messages hidden (/find to search, /compact to trim)`}
        </text>
      </Show>
      <For each={windowed().list}>
        {(message, index) => (
          <MessageView
            message={message}
            streaming={streamingId() === message.id}
            first={windowed().hidden + index() === 0}
          />
        )}
      </For>
    </scrollbox>
  )
}
