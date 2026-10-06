/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
import { paletteIndex } from "../store"

export interface PaletteAction {
  label: string
  description: string
}

export function CommandPalette(props: { actions: PaletteAction[]; onPick: (index: number) => void }) {
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
        <text fg={getTheme().dim}>{""}</text>
        <Show when={props.actions.length > 0} fallback={<text fg={getTheme().dim}>(nothing)</text>}>
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
        <text fg={getTheme().dim}>↑/↓ choose · enter run · esc close</text>
      </box>
    </box>
  )
}
