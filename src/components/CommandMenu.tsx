/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { THEME, sg } from "../theme"
import { matchCommands } from "../commands"
import { inputValue, menuIndex } from "../store"

export function CommandMenu() {
  const matches = () => {
    const value = inputValue()
    if (!value.startsWith("/") || value.includes(" ")) return []
    return matchCommands(value.slice(1))
  }

  return (
    <Show when={matches().length > 0}>
      <box
        flexDirection="column"
        flexShrink={0}
        border
        borderStyle="rounded"
        borderColor={THEME.track}
        paddingLeft={1}
        paddingRight={1}
      >
        <For each={matches()}>
          {(command, index) => (
            <text fg={menuIndex() === index() ? THEME.good : THEME.dim}>
              <span {...sg(menuIndex() === index() ? THEME.good : THEME.dim)}>
                {`${menuIndex() === index() ? "▶ " : "  "}/${command.name}`}
              </span>
              <span {...sg(THEME.dim)}>{`  ${command.description}`}</span>
            </text>
          )}
        </For>
        <text fg={THEME.dim}>tab to complete · enter to run</text>
      </box>
    </Show>
  )
}
