/** @jsxImportSource @opentui/solid */
import { For } from "solid-js"
import { getTheme, sg } from "../theme"
import { highlightLine } from "../syntax"
import type { DiffLine } from "../diff"

function gutterWidth(maxLine: number): number {
  return Math.max(2, String(Math.max(1, maxLine)).length)
}

export function CodeLines(props: { lines: string[]; start?: number }) {
  const width = () => String((props.start ?? 1) + props.lines.length).length
  return (
    <For each={props.lines}>
      {(line, index) => (
        <text fg={getTheme().body}>
          <span {...sg(getTheme().dim)}>{`${String((props.start ?? 1) + index()).padStart(width())} `}</span>
          <For each={highlightLine(line)}>{(span) => <span {...sg(span.fg)}>{span.text}</span>}</For>
        </text>
      )}
    </For>
  )
}

// A red/green diff with old/new line-number gutters.
export function DiffView(props: { lines: DiffLine[] }) {
  const width = () =>
    gutterWidth(
      props.lines.reduce((max, line) => Math.max(max, line.oldLine ?? 0, line.newLine ?? 0), 0),
    )
  return (
    <For each={props.lines}>
      {(line) => {
        const num = line.kind === "del" ? line.oldLine : line.newLine
        const marker = line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "
        const colour = line.kind === "add" ? getTheme().good : line.kind === "del" ? getTheme().bad : getTheme().dim
        return (
          <text>
            <span {...sg(getTheme().dim)}>{num !== undefined ? `${String(num).padStart(width())} ` : `${" ".repeat(width())} `}</span>
            <span {...sg(colour)}>{`${marker} ${line.text}`}</span>
          </text>
        )
      }}
    </For>
  )
}
