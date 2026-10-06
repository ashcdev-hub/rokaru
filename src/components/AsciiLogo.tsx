/** @jsxImportSource @opentui/solid */
import { For } from "solid-js"
import { loadLogo } from "../ascii"
import { sg } from "../theme"

export function AsciiLogo() {
  const rows = loadLogo()
  return (
    <box flexDirection="column">
      <For each={rows}>
        {(row) => (
          <text>
            <For each={row}>{(piece) => <span {...sg(piece.fg)}>{piece.text}</span>}</For>
          </text>
        )}
      </For>
    </box>
  )
}
