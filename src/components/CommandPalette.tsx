/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
import { paletteIndex } from "../store"

export interface PaletteAction {
  label: string
  description: string
}

export function filterPaletteActions<T extends PaletteAction>(actions: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return actions
  return actions.filter((action) =>
    `${action.label.replace(/^\//, "")} ${action.description}`.toLowerCase().includes(q),
  )
}

export function CommandPalette(props: { actions: PaletteAction[]; query: string; onPick: (index: number) => void }) {
  return (
    <box width="100%" height="100%" flexDirection="column" justifyContent="center" alignItems="center">
      <box
        flexDirection="column"
        width={64}
        border
        borderStyle="rounded"
        borderColor={getTheme().accent}
        backgroundColor={getTheme().panelBg}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={getTheme().accent}>
          <b>commands</b>
        </text>
        <text>
          <span {...sg(getTheme().text)}>{`> ${props.query}`}</span>
          <span {...sg(getTheme().dim)}>▌</span>
        </text>
        <Show when={props.actions.length > 0} fallback={<text fg={getTheme().dim}>(no matches)</text>}>
          <For each={props.actions}>
            {(action, index) => (
              <text fg={paletteIndex() === index() ? getTheme().good : getTheme().dim}>
                <span {...sg(paletteIndex() === index() ? getTheme().good : getTheme().dim)}>
                  {`${paletteIndex() === index() ? "▶ " : "  "}${action.label}`}
                </span>
                <span {...sg(getTheme().dim)}>{`  ${action.description}`}</span>
              </text>
            )}
          </For>
        </Show>
        <text fg={getTheme().dim}>{""}</text>
        <text fg={getTheme().dim}>type to filter · ↑/↓ choose · enter run · esc close</text>
      </box>
    </box>
  )
}
