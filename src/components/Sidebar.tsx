/** @jsxImportSource @opentui/solid */
import { THEME, HEX, sg } from "../theme"
import { contextPercent, metrics, model, modelLimit, promptTokens, showReasoning, status, workspace } from "../store"
import { bar, formatCompact, formatInt, formatRate, formatSeconds } from "../metrics"
import { VERSION } from "../version"

function Panel(props: { title: string; children: any }) {
  return (
    <box flexDirection="column" flexShrink={0} marginBottom={1}>
      <text fg={THEME.text}>
        <b>{props.title}</b>
      </text>
      {props.children}
    </box>
  )
}

function Field(props: { label: string; value: string; fg?: string }) {
  return (
    <text fg={props.fg ?? THEME.good}>
      <span {...sg(THEME.dim)}>{props.label.padEnd(6)}</span>
      <span {...sg(props.fg ?? THEME.good)}>{props.value}</span>
    </text>
  )
}

export function Sidebar(props: { width?: number }) {
  const usageColour = () => {
    const pct = contextPercent()
    if (pct >= 90) return THEME.bad
    if (pct >= 70) return THEME.warn
    return THEME.good
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
      borderColor={THEME.track}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
    >
      <text fg={THEME.accent}>
        <b>rokaru</b>
      </text>
      <text fg={THEME.dim}>private session</text>

      <box flexDirection="column" marginTop={1}>
        <Panel title="Session Context">
          <text fg={usageColour()}>
            <span {...sg(usageColour())}>{barParts().filled}</span>
            <span {...sg(THEME.dim)}>{barParts().track}</span>
            <span {...sg(THEME.text)}>{` ${Math.round(contextPercent())}%`}</span>
          </text>
          <text fg={THEME.dim}>{contextLine()}</text>
        </Panel>

        <Panel title="Model Speed">
          <Field label="TTFT" value={formatSeconds(metrics().ttft)} />
          <Field label="TPS" value={formatRate(metrics().tps)} />
          <Field label="OUT" value={metrics().outputTokens > 0 ? formatInt(metrics().outputTokens) : "--"} />
        </Panel>

        <Panel title="Model">
          <text fg={THEME.blue}>{model() || "none"}</text>
          <text fg={THEME.dim}>reasoning {showReasoning() ? "on" : "off"}</text>
        </Panel>

        <Panel title="Session">
          <text fg={THEME.dim}>{`state ${status()}`}</text>
          <text fg={THEME.dim}>{workspace() || ""}</text>
        </Panel>

        <Panel title="Privacy">
          <text fg={THEME.good}>loopback only</text>
          <text fg={THEME.good}>ram-only session</text>
          <text fg={THEME.dim}>wiped on exit</text>
        </Panel>
      </box>

      <box flexGrow={1} />
      <box flexShrink={0} marginTop={1}>
        <text fg={THEME.dim}>{`rokaru v${VERSION}`}</text>
      </box>
    </box>
  )
}
