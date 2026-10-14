/** @jsxImportSource @opentui/solid */
import { getTheme, sg } from "../theme"
import type { ConfirmRequest } from "../store"

// A small yes/no gate for destructive session actions (/clear, /new) that can't
// be undone in a RAM-only session.
export function ConfirmPrompt(props: { request: ConfirmRequest }) {
  return (
    <>
      <text fg={getTheme().warn}>
        <b>confirm</b>
      </text>
      <text fg={getTheme().text}>{props.request.message}</text>
      <text fg={getTheme().dim}>{""}</text>
      <text>
        <span {...sg(getTheme().good)}>{`y  ${props.request.confirmLabel}`}</span>
        <span {...sg(getTheme().dim)}>{"     "}</span>
        <span {...sg(getTheme().bad)}>{"n  cancel"}</span>
      </text>
      <text fg={getTheme().dim}>y confirm · n / esc cancel</text>
    </>
  )
}
