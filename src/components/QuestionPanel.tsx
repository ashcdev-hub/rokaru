/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
import { questionIndex, type QuestionRequest } from "../store"

export function QuestionPanel(props: { request: QuestionRequest }) {
  const customRow = () => props.request.options.length
  const active = (row: number) => questionIndex() === row
  const paint = (row: number) => (active(row) ? getTheme().good : getTheme().dim)
  return (
    <>
      <text fg={getTheme().accent}>
        <b>question</b>
      </text>
      <text fg={getTheme().text}>{props.request.question}</text>
      <text fg={getTheme().dim}>{""}</text>
      <For each={props.request.options}>
        {(option, index) => (
          <>
            <text fg={paint(index())}>
              <span {...sg(paint(index()))}>{`${active(index()) ? "▶ " : "  "}${index() + 1}. ${option.label}`}</span>
              <Show when={option.description}>
                <span {...sg(getTheme().dim)}>{`  ${option.description}`}</span>
              </Show>
            </text>
            <text fg={getTheme().dim}>{""}</text>
          </>
        )}
      </For>
      <text fg={paint(customRow())}>
        <span {...sg(paint(customRow()))}>{`${active(customRow()) ? "▶ " : "  "}${customRow() + 1}. ✎ type your own answer`}</span>
      </text>
      <text fg={getTheme().dim}>{`↑↓ select · enter submit · 1-${customRow() + 1} quick · esc dismiss`}</text>
    </>
  )
}
