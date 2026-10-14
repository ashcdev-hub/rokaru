/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
import { inputValue, mentionIndex, workspace } from "../store"
import { mentionMatches } from "../fileMentions"

// Fuzzy file menu shown while the prompt ends in an `@query` token.
export function MentionMenu() {
  const matches = () => mentionMatches(inputValue(), workspace())
  return (
    <Show when={matches()}>
      {(match) => (
        <box
          flexDirection="column"
          flexShrink={0}
          border
          borderStyle="rounded"
          borderColor={getTheme().accent}
          backgroundColor={getTheme().panelBg}
          paddingLeft={1}
          paddingRight={1}
        >
          <text>
            <span {...sg(getTheme().dim)}>{"@ "}</span>
            <span {...sg(getTheme().accent)}>{match().query || "…"}</span>
            <span {...sg(getTheme().dim)}>{`   ${match().files.length} match${match().files.length === 1 ? "" : "es"}`}</span>
          </text>
          <For each={match().files}>
            {(file, index) => {
              const selected = () => mentionIndex() === index()
              return (
                <text>
                  <span {...sg(selected() ? getTheme().good : getTheme().dim)}>{`${selected() ? "▶ " : "  "}· `}</span>
                  <span {...sg(selected() ? getTheme().text : getTheme().dim)}>{file}</span>
                </text>
              )
            }}
          </For>
          <text fg={getTheme().dim}>tab to insert · ↑/↓ to choose · esc cancel</text>
        </box>
      )}
    </Show>
  )
}
