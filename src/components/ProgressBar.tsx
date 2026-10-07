/** @jsxImportSource @opentui/solid */
import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { homedir } from "node:os"
import { getTheme, sg } from "../theme"
import { contextPercent, gitBranch, mode, status, statusDetail, workspace } from "../store"

const MAX_WIDTH = 16

function shorten(path: string): string {
  if (!path) return "~"
  const home = homedir()
  const out = path.startsWith(home) ? `~${path.slice(home.length)}` : path
  return out.length > 50 ? `…${out.slice(out.length - 49)}` : out
}

export function ProgressBar() {
  const [tick, setTick] = createSignal(0)
  const dimensions = useTerminalDimensions()

  const termWidth = () => Math.max(20, dimensions()?.width ?? 80)
  const barWidth = () => Math.max(6, Math.min(MAX_WIDTH, termWidth() - 78))

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

  const right = () => {
    const parts: string[] = [mode()]
    if (contextPercent() > 0) parts.push(`${Math.round(contextPercent())}%`)
    if (gitBranch().length > 0) parts.push(`⎇ ${gitBranch()}`)
    if (!busy()) parts.push("ctrl+p")
    return parts.join(" · ")
  }

  return (
    <box flexDirection="column" flexShrink={0} width="100%">
      <text fg={getTheme().track}>{"─".repeat(termWidth())}</text>
      <box
        flexDirection="row"
        height={1}
        width="100%"
        backgroundColor={getTheme().panelBg}
        paddingLeft={1}
        paddingRight={1}
      >
        <Show
          when={busy()}
          fallback={
            <text fg={getTheme().dim}>
              <span {...sg(getTheme().meter)}>{"◧ "}</span>
              <span {...sg(getTheme().dim)}>{shorten(workspace())}</span>
            </text>
          }
        >
          <text fg={getTheme().meter}>{cells()}</text>
          <text fg={getTheme().dim}>{`  ${statusDetail() || status()}   esc interrupt`}</text>
        </Show>
        <box flexGrow={1} />
        <text fg={getTheme().dim}>{right()}</text>
      </box>
    </box>
  )
}
