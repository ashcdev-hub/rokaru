/** @jsxImportSource @opentui/solid */
import { For, Show, createMemo } from "solid-js"
import { getTheme, sg } from "../theme"
import { changesIndex, changesList } from "../store"
import { diffForChange, sessionChanges } from "../undo"
import { DiffView } from "./Code"

const MAX_DIFF_LINES = 14

// Lists every file the model changed this session with a diff preview and a
// per-file revert (built on the in-memory undo snapshots).
export function ChangesPanel() {
  const selected = createMemo(() => sessionChanges()[changesIndex()])
  return (
    <box width="100%" height="100%" flexDirection="column" justifyContent="center" alignItems="center">
      <box
        flexDirection="column"
        width={80}
        border
        borderStyle="rounded"
        borderColor={getTheme().accent}
        backgroundColor={getTheme().panelBg}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={getTheme().accent}>
          <b>changes this session</b>
        </text>
        <text fg={getTheme().dim}>{""}</text>
        <Show
          when={changesList().length > 0}
          fallback={<text fg={getTheme().dim}>(nothing has been changed this session)</text>}
        >
          <For each={changesList()}>
            {(entry, index) => (
              <text>
                <span {...sg(changesIndex() === index() ? getTheme().good : getTheme().dim)}>
                  {changesIndex() === index() ? "▶ " : "  "}
                </span>
                <span {...sg(getTheme().text)}>{entry.path}</span>
                <span {...sg(getTheme().dim)}>{`  ${entry.edits} edit${entry.edits === 1 ? "" : "s"}`}</span>
              </text>
            )}
          </For>
          <text fg={getTheme().dim}>{""}</text>
          <Show when={selected()}>
            {(change) => (
              <box flexDirection="column" border borderStyle="rounded" borderColor={getTheme().panelBorder} paddingLeft={1} paddingRight={1}>
                <text fg={getTheme().dim}>{change().path}</text>
                <DiffView lines={diffForChange(change()).slice(0, MAX_DIFF_LINES)} />
                <Show when={diffForChange(change()).length > MAX_DIFF_LINES}>
                  <text fg={getTheme().dim}>{`… (${diffForChange(change()).length - MAX_DIFF_LINES} more lines)`}</text>
                </Show>
              </box>
            )}
          </Show>
        </Show>
        <text fg={getTheme().dim}>{""}</text>
        <text fg={getTheme().dim}>↑/↓ move · enter revert selected file · esc close</text>
      </box>
    </box>
  )
}
