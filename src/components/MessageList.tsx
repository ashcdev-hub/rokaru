/** @jsxImportSource @opentui/solid */
import { For, Index, Show, createSignal, onCleanup, onMount } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { getTheme, sg } from "../theme"
import { Markdown } from "./Markdown"
import { DiffView } from "./Code"
import { FadeIn, Spinner } from "./anim"
import { decorateAssistant } from "../highlight"
import {
  expandTools,
  messages,
  status,
  thinkingVisible,
  todos,
  toggleThinking,
  toggleToolExpanded,
} from "../store"
import type { Part, UIMessage } from "../store"

const COLLAPSE_LINES = 10

function collapse(text: string, max: number, expanded: boolean): string {
  const lines = text.split("\n")
  if (lines.length <= max || expanded) return text
  return lines.slice(0, max).join("\n") + `\n… (${lines.length - max} more lines · click to expand)`
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
    return bits.length > 0 ? `  ${bits.join(" · ")}` : ""
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
          <Show when={part.result.length > 0}>
            <text fg={part.status === "error" || part.status === "denied" ? getTheme().bad : getTheme().dim}>
              {collapse(part.result, COLLAPSE_LINES, expanded())}
            </text>
          </Show>
        }
      >
        <DiffView lines={part.diff!} />
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
    <box flexDirection="column" marginTop={1} onMouseDown={() => toggleThinking(props.message.id)}>
      <text fg={getTheme().warn}>
        <span {...sg(getTheme().warn)}>{`${expanded() ? "▾" : "▸"} ${label()}`}</span>
      </text>
      <Show when={expanded()}>
        <text fg={getTheme().dim}>
          <i>{props.text}</i>
        </text>
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

function Separator() {
  const dims = useTerminalDimensions()
  const width = () => Math.max(10, (dims()?.width ?? 80) - 34 - 4)
  return <text fg={getTheme().track}>{"─".repeat(width())}</text>
}

function MessageView(props: { message: UIMessage; streaming: boolean; first: boolean }) {
  return (
    <FadeIn>
      <Show
        when={props.message.role !== "info"}
        fallback={
          <box flexDirection="column" marginBottom={1} paddingLeft={1}>
            <For each={props.message.parts}>
              {(part) => <text fg={getTheme().dim}>{part.kind === "text" ? part.text : ""}</text>}
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
          backgroundColor={props.message.role === "user" ? getTheme().panelBg : undefined}
          paddingLeft={props.message.role === "user" ? 1 : 0}
          paddingRight={props.message.role === "user" ? 1 : 0}
          paddingTop={props.message.role === "user" ? 1 : 0}
          paddingBottom={props.message.role === "user" ? 1 : 0}
        >
          <text fg={props.message.role === "user" ? getTheme().accent : getTheme().blue}>
            <b>{props.message.role === "user" ? "you" : "agent"}</b>
          </text>
          <box flexDirection="column" paddingLeft={1}>
            <For each={props.message.parts}>
              {(part) => <PartView message={props.message} part={part} streaming={props.streaming} />}
            </For>
            <Show when={props.message.images && props.message.images.length > 0}>
              <text fg={getTheme().dim}>{`📎 ${props.message.images!.join("  ")}`}</text>
            </Show>
            <Show when={props.streaming}>
              <StreamingCursor />
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
    </box>
  )
}

export function MessageList() {
  const streamingId = () => {
    const list = messages()
    const last = list[list.length - 1]
    if (!last || last.role !== "assistant") return undefined
    const s = status()
    return s === "streaming" || s === "thinking" || s === "tool" ? last.id : undefined
  }

  return (
    <scrollbox flexGrow={1} stickyScroll={true} stickyStart="bottom" paddingLeft={1} paddingRight={1}>
      <Show when={messages().length === 0}>
        <EmptyState />
      </Show>
      <Index each={messages()}>
        {(message, index) => (
          <MessageView message={message()} streaming={streamingId() === message().id} first={index === 0} />
        )}
      </Index>
    </scrollbox>
  )
}
