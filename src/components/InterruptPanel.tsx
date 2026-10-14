/** @jsxImportSource @opentui/solid */
import { For } from "solid-js"
import { getTheme, sg } from "../theme"
import { INTERRUPT_OPTIONS, interruptIndex } from "../store"

// Shown when esc is pressed while the model is working: stop now, finish the
// current tool then stop, or continue.
export function InterruptPanel() {
  return (
    <>
      <text fg={getTheme().warn}>
        <b>interrupt</b>
      </text>
      <text fg={getTheme().dim}>the model is working. what should happen?</text>
      <text fg={getTheme().dim}>{""}</text>
      <For each={INTERRUPT_OPTIONS}>
        {(option, index) => (
          <text fg={interruptIndex() === index() ? getTheme().good : getTheme().dim}>
            <span {...sg(interruptIndex() === index() ? getTheme().good : getTheme().dim)}>
              {`${interruptIndex() === index() ? "▶ " : "  "}${index() + 1}. ${option}`}
            </span>
          </text>
        )}
      </For>
      <text fg={getTheme().dim}>{`↑/↓ select · enter confirm · 1-${INTERRUPT_OPTIONS.length} quick · esc cancel`}</text>
    </>
  )
}
