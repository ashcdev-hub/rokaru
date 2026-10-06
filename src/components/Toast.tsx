/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { THEME } from "../theme"
import { toast } from "../store"

export function Toast() {
  return (
    <Show when={toast()}>
      <box
        position="absolute"
        top={1}
        right={2}
        border
        borderStyle="rounded"
        borderColor={THEME.good}
        paddingLeft={1}
        paddingRight={1}
        backgroundColor="#101418"
      >
        <text fg={THEME.good}>{`✓ ${toast()}`}</text>
      </box>
    </Show>
  )
}
