/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
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
        borderColor={getTheme().track}
        paddingLeft={1}
        paddingRight={1}
      >
        <For each={matches()}>
          {(command, index) => (
            <text fg={menuIndex() === index() ? getTheme().good : getTheme().dim}>
              <span {...sg(menuIndex() === index() ? getTheme().good : getTheme().dim)}>
                {`${menuIndex() === index() ? "▶ " : "  "}/${command.name}`}
              </span>
              <span {...sg(getTheme().dim)}>{`  ${command.description}`}</span>
            </text>
          )}
        </For>
        <text fg={getTheme().dim}>tab to complete · enter to run</text>
      </box>
    </Show>
  )
}
