/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { getTheme } from "../theme"
import { toast, type ToastKind } from "../store"

function style(kind: ToastKind): { icon: string; colour: string } {
  const theme = getTheme()
  switch (kind) {
    case "error":
      return { icon: "✕", colour: theme.bad }
    case "warn":
      return { icon: "!", colour: theme.warn }
    case "info":
      return { icon: "›", colour: theme.blue }
    default:
      return { icon: "✓", colour: theme.good }
  }
}

export function Toast() {
  return (
    <Show when={toast()}>
      {(current) => (
        <box
          position="absolute"
          top={1}
          right={2}
          border
          borderStyle="rounded"
          borderColor={style(current().kind).colour}
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={getTheme().panelBg}
        >
          <text fg={style(current().kind).colour}>{`${style(current().kind).icon} ${current().message}`}</text>
        </box>
      )}
    </Show>
  )
}
