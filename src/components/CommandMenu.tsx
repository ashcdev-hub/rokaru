/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
import { frequentCommandNames, orderedMenuCommands } from "../commands"
import { commandUsage, inputValue, menuIndex } from "../store"

export function CommandMenu() {
  const prefix = () => {
    const value = inputValue()
    if (!value.startsWith("/") || value.includes(" ")) return undefined
    return value.slice(1)
  }
  const matches = () => {
    const p = prefix()
    return p === undefined ? [] : orderedMenuCommands(p, commandUsage())
  }
  // How many of the leading rows are the "frequent" section (bare `/` only).
  const frequentCount = () => (prefix()?.trim().length === 0 ? frequentCommandNames(commandUsage()).length : 0)

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
        <Show when={frequentCount() > 0}>
          <text fg={getTheme().meter}>frequent</text>
        </Show>
        <For each={matches()}>
          {(command, index) => (
            <>
              <Show when={frequentCount() > 0 && index() === frequentCount()}>
                <text fg={getTheme().dim}>{"—"}</text>
              </Show>
              <text fg={menuIndex() === index() ? getTheme().good : getTheme().dim}>
                <span {...sg(menuIndex() === index() ? getTheme().good : getTheme().dim)}>
                  {`${menuIndex() === index() ? "▶ " : "  "}/${command.name}`}
                </span>
                <span {...sg(getTheme().dim)}>{`  ${command.description}`}</span>
              </text>
            </>
          )}
        </For>
        <text fg={getTheme().dim}>tab to complete · enter to run</text>
      </box>
    </Show>
  )
}
