/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { getTheme, sg } from "../theme"
import { questionIndex, selectedCount, selectedOptions, type QuestionRequest } from "../store"

export function QuestionPanel(props: { request: QuestionRequest }) {
  const multi = () => props.request.multiSelect === true
  const lastRow = () => props.request.options.length
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
        <Show when={multi()}>
          <text fg={getTheme().dim}>{`${selectedCount()} selected`}</text>
        </Show>
        <text fg={getTheme().dim}>{""}</text>
        <For each={props.request.options}>
          {(option, index) => {
            // Read questionIndex() inside the row so each row tracks it
            // independently (previously the highlight stuck on visited rows).
            const row = index()
            const cursor = () => questionIndex() === row
            const checked = () => multi() && selectedOptions()[row] === true
            // Checked rows get their own fill (distinct from the cursor's), so
            // the whole choice stands out rather than a tiny tick glyph.
            const bg = () => (cursor() ? getTheme().good : checked() ? getTheme().tool : getTheme().panelBg)
            const fg = () => (cursor() || checked() ? getTheme().background : getTheme().dim)
            const marker = () => (multi() ? (selectedOptions()[row] ? "☑" : "☐") : cursor() ? "◉" : "○")
            const label = () =>
              ` ${cursor() ? "▶" : " "} ${marker()} ${row + 1}. ${option.label}${
                option.description ? `   ${option.description}` : ""
              } `
            return (
              <text>
                <span {...sg(fg(), bg(), checked() ? TextAttributes.BOLD : undefined)}>{label()}</span>
              </text>
            )
          }}
        </For>
        <text>
          <span
            {...sg(
              questionIndex() === lastRow() ? getTheme().background : getTheme().dim,
              questionIndex() === lastRow() ? getTheme().good : getTheme().panelBg,
            )}
          >
            {multi()
              ? ` ${questionIndex() === lastRow() ? "▶" : " "} ${lastRow() + 1}. ✓ submit (${selectedCount()} selected) `
              : ` ${questionIndex() === lastRow() ? "▶" : " "} ${lastRow() + 1}. ✎ type your own answer `}
          </span>
        </text>
        <text fg={getTheme().dim}>
          {multi()
            ? `↑↓ move · enter toggle · s submit · 1-${lastRow() + 1} quick · esc dismiss`
            : `↑↓ select · enter submit · 1-${lastRow() + 1} quick · esc dismiss`}
        </text>
      </box>
    </box>
  )
}

