/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { THEME, sg } from "../theme"
import { messages, showReasoning, status } from "../store"
import type { Part, UIMessage } from "../store"

function truncate(text: string, max = 4000): string {
  if (text.length <= max) return text
  return text.slice(0, max) + `\n… (${text.length - max} more chars)`
}

function statusColour(s: Extract<Part, { kind: "tool" }>["status"]): string {
  switch (s) {
    case "ok":
      return THEME.good
    case "error":
      return THEME.bad
    case "denied":
      return THEME.warn
    case "running":
      return THEME.accent
    default:
      return THEME.dim
  }
}

function PartView(props: { part: Part }) {
  const part = props.part
  if (part.kind === "text") {
    return <text fg={THEME.text}>{part.text}</text>
  }
  if (part.kind === "reasoning") {
    return (
      <Show when={showReasoning()}>
        <text fg={THEME.dim}>
          <i>{part.text}</i>
        </text>
      </Show>
    )
  }
  return (
    <box flexDirection="column" marginTop={1}>
      <text fg={statusColour(part.status)}>
        <span {...sg(THEME.tool)}>{`⚙ ${part.name}`}</span>
        <span {...sg(THEME.dim)}>{`  ${part.status}`}</span>
      </text>
      <text fg={THEME.dim}>{truncate(part.args, 400)}</text>
      <Show when={part.result.length > 0}>
        <text fg={part.status === "error" || part.status === "denied" ? THEME.bad : THEME.dim}>
          {truncate(part.result, 4000)}
        </text>
      </Show>
    </box>
  )
}

function MessageView(props: { message: UIMessage; streaming: boolean }) {
  return (
    <box flexDirection="column" marginBottom={1}>
      <text fg={props.message.role === "user" ? THEME.accent : THEME.blue}>
        <b>{props.message.role === "user" ? "you" : "assistant"}</b>
      </text>
      <box flexDirection="column" paddingLeft={1}>
        <For each={props.message.parts}>{(part) => <PartView part={part} />}</For>
        <Show when={props.streaming}>
          <text fg={THEME.accent}>▌</text>
        </Show>
      </box>
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
    <scrollbox
      flexGrow={1}
      stickyScroll={true}
      stickyStart="bottom"
      paddingLeft={1}
      paddingRight={1}
    >
      <For each={messages()}>
        {(message) => <MessageView message={message} streaming={streamingId() === message.id} />}
      </For>
    </scrollbox>
  )
}
