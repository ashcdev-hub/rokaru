/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { THEME, sg } from "../theme"
import { markdownStyle } from "../markdown"
import { expandTools, messages, status, thinkingVisible, toggleThinking } from "../store"
import type { Part, UIMessage } from "../store"

const COLLAPSE_LINES = 10

function collapse(text: string, max: number): string {
  const lines = text.split("\n")
  if (lines.length <= max || expandTools()) return text
  return lines.slice(0, max).join("\n") + `\n… (${lines.length - max} more lines · ctrl+o to expand)`
}

function statusColour(s: Extract<Part, { kind: "tool" }>["status"]): string {
  switch (s) {
    case "ok":
      return THEME.panelBorder
    case "error":
      return THEME.bad
    case "denied":
      return THEME.warn
    case "running":
      return THEME.accent
    default:
      return THEME.panelBorder
  }
}

function statusSuffix(s: Extract<Part, { kind: "tool" }>["status"]): string {
  switch (s) {
    case "running":
      return "  …"
    case "error":
      return "  failed"
    case "denied":
      return "  denied"
    default:
      return ""
  }
}

function parseArgs(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function toolHeader(name: string, argsRaw: string): { lead: string; text: string; colour: string } {
  const args = parseArgs(argsRaw)
  switch (name) {
    case "read_file":
      return { lead: "→", text: `Read ${args.path ?? ""}`, colour: THEME.blue }
    case "write_file":
      return { lead: "←", text: `Write ${args.path ?? ""}`, colour: THEME.accent }
    case "edit_file":
      return { lead: "←", text: `Edit ${args.path ?? ""}`, colour: THEME.accent }
    case "list_dir":
      return { lead: "→", text: `List ${args.path ?? "."}`, colour: THEME.blue }
    case "glob":
      return { lead: "→", text: `Glob ${args.pattern ?? ""}`, colour: THEME.blue }
    case "grep":
      return { lead: "→", text: `Grep ${args.pattern ?? ""}`, colour: THEME.blue }
    case "bash":
      return { lead: "$", text: args.command ?? argsRaw, colour: THEME.good }
    default:
      return { lead: "⚙", text: name, colour: THEME.tool }
  }
}

function AssistantText(props: { text: string; streaming: boolean }) {
  return (
    <Show when={!props.streaming} fallback={<text fg={THEME.text}>{props.text}</text>}>
      <box flexDirection="column" width="100%">
        <markdown content={props.text} syntaxStyle={markdownStyle()} conceal={true} />
      </box>
    </Show>
  )
}

function ToolView(props: { part: Extract<Part, { kind: "tool" }> }) {
  const part = props.part
  const header = () => toolHeader(part.name, part.args)
  return (
    <box
      flexDirection="column"
      marginTop={1}
      border
      borderStyle="rounded"
      borderColor={statusColour(part.status)}
      backgroundColor={THEME.panelBg}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={header().colour}>
        <span {...sg(header().colour)}>{`${header().lead} `}</span>
        <span {...sg(THEME.text)}>{header().text}</span>
        <span {...sg(part.status === "error" ? THEME.bad : THEME.dim)}>{statusSuffix(part.status)}</span>
      </text>
      <Show
        when={part.diff && part.diff.length > 0}
        fallback={
          <Show when={part.result.length > 0}>
            <text fg={part.status === "error" || part.status === "denied" ? THEME.bad : THEME.dim}>
              {collapse(part.result, COLLAPSE_LINES)}
            </text>
          </Show>
        }
      >
        <For each={part.diff}>
          {(line) => (
            <text fg={line.kind === "add" ? THEME.good : line.kind === "del" ? THEME.bad : THEME.dim}>
              {`${line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "} ${line.text}`}
            </text>
          )}
        </For>
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
      <text fg={THEME.warn}>
        <span {...sg(THEME.warn)}>{`${expanded() ? "▾" : "▸"} ${label()}`}</span>
      </text>
      <Show when={expanded()}>
        <text fg={THEME.dim}>
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
  return <ToolView part={part} />
}

function MessageView(props: { message: UIMessage; streaming: boolean }) {
  return (
    <Show
      when={props.message.role !== "info"}
      fallback={
        <box flexDirection="column" marginBottom={1} paddingLeft={1}>
          <For each={props.message.parts}>
            {(part) => <text fg={THEME.dim}>{part.kind === "text" ? part.text : ""}</text>}
          </For>
        </box>
      }
    >
      <box flexDirection="column" marginBottom={1}>
        <text fg={props.message.role === "user" ? THEME.accent : THEME.blue}>
          <b>{props.message.role === "user" ? "you" : "assistant"}</b>
        </text>
        <box flexDirection="column" paddingLeft={1}>
          <For each={props.message.parts}>
            {(part) => <PartView message={props.message} part={part} streaming={props.streaming} />}
          </For>
          <Show when={props.message.images && props.message.images.length > 0}>
            <text fg={THEME.dim}>{`📎 ${props.message.images!.join("  ")}`}</text>
          </Show>
          <Show when={props.streaming}>
            <text fg={THEME.accent}>▌</text>
          </Show>
        </box>
      </box>
    </Show>
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
      <For each={messages()}>
        {(message) => <MessageView message={message} streaming={streamingId() === message.id} />}
      </For>
    </scrollbox>
  )
}
