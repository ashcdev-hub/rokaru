/** @jsxImportSource @opentui/solid */
import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { homedir } from "node:os"
import { THEME } from "../theme"
import { model, status, statusDetail, workspace } from "../store"

const MAX_WIDTH = 16

function shorten(path: string): string {
  if (!path) return "~"
  const home = homedir()
  let out = path.startsWith(home) ? `~${path.slice(home.length)}` : path
  if (out.length > 70) out = `…${out.slice(out.length - 69)}`
  return out
}

export function ProgressBar() {
  const [tick, setTick] = createSignal(0)
  const dimensions = useTerminalDimensions()

  // Leave room for the sidebar and the status text so the bar never clips it.
  const barWidth = () => Math.max(6, Math.min(MAX_WIDTH, (dimensions()?.width ?? 80) - 64))

  const busy = () => {
    const s = status()
    return s === "thinking" || s === "streaming" || s === "tool" || s === "permission"
  }

  createEffect(() => {
    if (!busy()) return
    const id = setInterval(() => setTick((t) => t + 1), 80)
    onCleanup(() => clearInterval(id))
  })

  const cells = () => {
    const width = barWidth()
    const position = (tick() % (width + 6)) - 3
    let out = ""
    for (let i = 0; i < width; i++) {
      const distance = Math.abs(i - position)
      out += distance === 0 ? "█" : distance === 1 ? "▓" : distance === 2 ? "▒" : distance === 3 ? "░" : "·"
    }
    return out
  }

  return (
    <box flexDirection="row" flexShrink={0} height={1} paddingLeft={1} paddingRight={1}>
      <Show
        when={busy()}
        fallback={
          <text fg={THEME.dim}>
            <span {...{ style: { fg: THEME.good } }}>{"◧ "}</span>
            <span {...{ style: { fg: THEME.dim } }}>{shorten(workspace())}</span>
            <span {...{ style: { fg: THEME.track } }}>{model() ? `   ·   ${model()}` : ""}</span>
          </text>
        }
      >
        <text fg={THEME.accent}>{cells()}</text>
        <text fg={THEME.dim}>{`  ${statusDetail() || status()}   esc interrupt`}</text>
      </Show>
    </box>
  )
}

