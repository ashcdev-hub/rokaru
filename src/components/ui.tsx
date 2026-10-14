/** @jsxImportSource @opentui/solid */
import { sg } from "../theme"

// A small tinted label used for the you/agent header badges.
export function Pill(props: { label: string; fg: string; bg: string; glyph?: string }) {
  return (
    <text>
      <span {...sg(props.fg, props.bg)}>{` ${props.glyph ? `${props.glyph} ` : ""}${props.label} `}</span>
    </text>
  )
}

// Shorten a long filename/label for a chip.
export function truncateLabel(text: string, max = 32): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
