/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
import { contextPercent, mcpServers, metrics, modelLimit, promptTokens, todos } from "../store"
import { bar, formatCompact, formatInt, formatRate, formatSeconds } from "../metrics"
import { VERSION } from "../version"

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
      <span {...sg(getTheme().dim)}>{props.label.padEnd(6)}</span>
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

  const contextLine = () => {
    const limit = modelLimit()
    const used = promptTokens()
    const limitText = limit > 0 ? formatCompact(limit) : "--"
    return `${formatCompact(used)} / ${limitText}`
  }

  const barParts = () => bar(contextPercent(), 22)

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

      <box flexDirection="column" marginTop={1}>
        <Show when={todos().length > 0}>
          <Panel title="Todo">
            <For each={todos()}>
              {(todo) => (
                <text
                  fg={
                    todo.status === "completed"
                      ? getTheme().dim
                      : todo.status === "in_progress"
                        ? getTheme().accent
                        : getTheme().text
                  }
                >
                  {`${todo.status === "completed" ? "[✓]" : todo.status === "in_progress" ? "[•]" : "[ ]"} ${todo.content}`}
                </text>
              )}
            </For>
          </Panel>
        </Show>

        <Panel title="Session Context">
          <text fg={usageColour()}>
            <span {...sg(usageColour())}>{barParts().filled}</span>
            <span {...sg(getTheme().dim)}>{barParts().track}</span>
            <span {...sg(getTheme().text)}>{` ${Math.round(contextPercent())}%`}</span>
          </text>
          <text fg={getTheme().dim}>{contextLine()}</text>
        </Panel>

        <Panel title="Model Speed">
          <Field label="TTFT" value={formatSeconds(metrics().ttft)} />
          <Field label="TPS" value={formatRate(metrics().tps)} />
          <Field label="OUT" value={metrics().outputTokens > 0 ? formatInt(metrics().outputTokens) : "--"} />
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
      </box>

      <box flexGrow={1} />
      <box flexShrink={0} marginTop={1}>
        <text fg={getTheme().dim}>{`rokaru v${VERSION}`}</text>
      </box>
    </box>
  )
}
