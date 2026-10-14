/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
import { questionIndex, type QuestionRequest } from "../store"

export function QuestionPanel(props: { request: QuestionRequest }) {
  const customRow = () => props.request.options.length
  const active = (row: number) => questionIndex() === row
  return (
    <box flexDirection="column">
      <box
        flexDirection="column"
        border
        borderStyle="rounded"
        borderColor={getTheme().accent}
        backgroundColor={getTheme().panelBg}
        title="question"
        titleColor={getTheme().accent}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={getTheme().text}>{props.request.question}</text>
        <text fg={getTheme().dim}>{""}</text>
        <For each={props.request.options}>
          {(option, index) => (
            <text>
              <span
                {...sg(active(index()) ? getTheme().background : getTheme().dim, active(index()) ? getTheme().good : undefined)}
              >
                {` ${active(index()) ? "▣" : "☐"} ${index() + 1}. ${option.label} `}
              </span>
              <Show when={option.description}>
                <span {...sg(getTheme().dim)}>{`  ${option.description}`}</span>
              </Show>
            </text>
          )}
        </For>
        <text>
          <span
            {...sg(active(customRow()) ? getTheme().background : getTheme().dim, active(customRow()) ? getTheme().good : undefined)}
          >
            {` ${active(customRow()) ? "▣" : "☐"} ${customRow() + 1}. ✎ type your own answer `}
          </span>
        </text>
        <text fg={getTheme().dim}>{`↑↓ select · enter submit · 1-${customRow() + 1} quick · esc dismiss`}</text>
      </box>
    </box>
  )
}
