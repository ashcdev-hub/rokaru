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
          borderColor={getTheme().track}
          paddingLeft={1}
          paddingRight={1}
        >
          <For each={match().files}>
            {(file, index) => (
              <text fg={mentionIndex() === index() ? getTheme().good : getTheme().dim}>
                <span {...sg(mentionIndex() === index() ? getTheme().good : getTheme().dim)}>
                  {`${mentionIndex() === index() ? "▶ " : "  "}@${file}`}
                </span>
              </text>
            )}
          </For>
          <text fg={getTheme().dim}>tab to insert · ↑/↓ to choose</text>
        </box>
      )}
    </Show>
  )
}
