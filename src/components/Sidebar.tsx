/** @jsxImportSource @opentui/solid */
import { For, Show, createEffect, createSignal, untrack } from "solid-js"
import { useTimeline } from "@opentui/solid"
import { getTheme, sg } from "../theme"
import { contextPercent, gitBranch, mcpServers, metrics, modelLimit, promptTokens, todos } from "../store"
import { formatCompact, formatInt, formatRate, formatSeconds } from "../metrics"
import { VERSION } from "../version"

const BAR_WIDTH = 22

function Panel(props: { title: string; children: any }) {
  return (
    <box flexDirection="column" flexShrink={0} marginBottom={1}>
      <text fg={getTheme().text}>
        <b>{props.title}</b>
      </text>
      {props.children}
    </box>
  )
}

function Field(props: { label: string; value: string; fg?: string }) {
  return (
    <text fg={props.fg ?? getTheme().good}>
      <span {...sg(getTheme().dim)}>{props.label.padEnd(7)}</span>
      <span {...sg(props.fg ?? getTheme().good)}>{props.value}</span>
    </text>
  )
}

export function Sidebar(props: { width?: number }) {
  const usageColour = () => {
    const pct = contextPercent()
    if (pct >= 90) return getTheme().bad
    if (pct >= 70) return getTheme().warn
    return getTheme().good
  }

  const ttftColour = () => {
    const t = metrics().ttft
    if (!t) return getTheme().dim
    return t <= 3 ? getTheme().good : t <= 8 ? getTheme().warn : getTheme().bad
  }

  const tpsColour = () => {
    const t = metrics().tps
    if (!t) return getTheme().dim
    return t >= 25 ? getTheme().good : t >= 12 ? getTheme().warn : getTheme().bad
  }

  // Animate the context bar fill smoothly towards the new value.
  const targetFill = () => {
    const limit = modelLimit() || 1
    return Math.min(1, Math.max(0, promptTokens() / limit))
  }
  const [shownFill, setShownFill] = createSignal(targetFill())
  const timeline = useTimeline()
  createEffect(() => {
    const target = targetFill()
    timeline.add(
      { value: untrack(shownFill) },
      {
        value: target,
        duration: 400,
        ease: "outQuad",
        once: true,
        onUpdate: (anim: any) => setShownFill(anim.targets[0].value),
      },
    )
    if (!timeline.isPlaying) timeline.play()
  })

  const segments = () => {
    const total = Math.round(Math.min(1, shownFill()) * BAR_WIDTH)
    const prompt = promptTokens()
    const cachedFrac = prompt > 0 ? Math.min(1, metrics().cachedTokens / prompt) : 0
    const cachedN = Math.round(total * cachedFrac)
    return { cached: cachedN, fresh: Math.max(0, total - cachedN), rest: Math.max(0, BAR_WIDTH - total) }
  }

  const cacheHit = () => {
    const prompt = promptTokens()
    if (prompt <= 0) return 0
    return Math.round((metrics().cachedTokens / prompt) * 100)
  }

  const contextLine = () => {
    const limit = modelLimit()
    const limitText = limit > 0 ? formatCompact(limit) : "--"
    return `${formatCompact(promptTokens())} / ${limitText}`
  }

  return (
    <box
      width={props.width ?? 32}
      flexDirection="column"
      flexShrink={0}
      overflow="hidden"
      border
      borderStyle="rounded"
      borderColor={getTheme().track}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
    >
      <text fg={getTheme().accent}>
        <b>rokaru</b>
      </text>
      <text fg={getTheme().dim}>private session</text>
      <Show when={gitBranch().length > 0}>
        <text fg={getTheme().dim}>{`⎇ ${gitBranch()}`}</text>
      </Show>

      <box flexDirection="column" marginTop={1}>
        <Panel title="Session Context">
          <text>
            <span {...sg(getTheme().blue)}>{"█".repeat(segments().cached)}</span>
            <span {...sg(getTheme().good)}>{"█".repeat(segments().fresh)}</span>
            <span {...sg(getTheme().track)}>{"░".repeat(segments().rest)}</span>
            <span {...sg(usageColour())}>{` ${Math.round(contextPercent())}%`}</span>
          </text>
          <text fg={getTheme().dim}>{contextLine()}</text>
          <Show when={cacheHit() > 0}>
            <text fg={getTheme().dim}>{`cache ${cacheHit()}%`}</text>
          </Show>
        </Panel>

        <Panel title="Model Speed">
          <Field label="TTFT" value={formatSeconds(metrics().ttft)} fg={ttftColour()} />
          <Field label="TPS" value={formatRate(metrics().tps)} fg={tpsColour()} />
          <Field label="OUT" value={metrics().outputTokens > 0 ? formatInt(metrics().outputTokens) : "--"} />
          <Field label="TIME" value={formatSeconds(metrics().elapsed)} fg={getTheme().dim} />
        </Panel>

        <Show when={mcpServers().length > 0}>
          <Panel title="MCP">
            <For each={mcpServers()}>
              {(server) => (
                <text
                  fg={
                    server.status === "connected"
                      ? getTheme().good
                      : server.status === "error"
                        ? getTheme().bad
                        : server.status === "connecting"
                          ? getTheme().accent
                          : getTheme().dim
                  }
                >
                  {`${
                    server.status === "connected"
                      ? "✓"
                      : server.status === "error"
                        ? "✗"
                        : server.status === "connecting"
                          ? "…"
                          : "○"
                  } ${server.name}${server.status === "connected" ? ` ${server.tools}` : ""}`}
                </text>
              )}
            </For>
          </Panel>
        </Show>

        <Show when={todos().length > 0}>
          <Panel title="Todo">
            <For each={todos()}>
              {(todo) => (
                <text
                  fg={todo.status === "completed" ? getTheme().dim : todo.status === "in_progress" ? getTheme().accent : getTheme().text}
                >
                  {`${todo.status === "completed" ? "[✓]" : todo.status === "in_progress" ? "[•]" : "[ ]"} ${todo.content}`}
                </text>
              )}
            </For>
          </Panel>
        </Show>
      </box>

      <box flexGrow={1} />
      <box flexShrink={0} marginTop={1}>
        <text fg={getTheme().dim}>{`rokaru v${VERSION}`}</text>
      </box>
    </box>
  )
}
