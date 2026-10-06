/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
import { mcpPanelIndex, type McpServerInfo } from "../store"

function statusColour(status: McpServerInfo["status"]): string {
  switch (status) {
    case "connected":
      return getTheme().good
    case "error":
      return getTheme().bad
    case "connecting":
      return getTheme().accent
    default:
      return getTheme().dim
  }
}

function statusIcon(status: McpServerInfo["status"]): string {
  switch (status) {
    case "connected":
      return "✓"
    case "error":
      return "✗"
    case "connecting":
      return "…"
    default:
      return "○"
  }
}

function statusText(server: McpServerInfo): string {
  switch (server.status) {
    case "connected":
      return `connected · ${server.tools} tools`
    case "error":
      return `error · ${server.error ?? "failed"}`
    case "connecting":
      return "connecting…"
    default:
      return "disabled"
  }
}

export function McpPanel(props: { servers: McpServerInfo[] }) {
  return (
    <box width="100%" height="100%" flexDirection="column" justifyContent="center" alignItems="center">
      <box
        flexDirection="column"
        width={72}
        border
        borderStyle="rounded"
        borderColor={getTheme().accent}
        backgroundColor={getTheme().panelBg}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={getTheme().accent}>
          <b>mcp servers</b>
        </text>
        <text fg={getTheme().dim}>{""}</text>
        <Show when={props.servers.length > 0} fallback={<text fg={getTheme().dim}>(none configured)</text>}>
          <For each={props.servers}>
            {(server, index) => (
              <text>
                <span {...sg(mcpPanelIndex() === index() ? getTheme().good : getTheme().dim)}>
                  {mcpPanelIndex() === index() ? "▶ " : "  "}
                </span>
                <span {...sg(statusColour(server.status))}>{`${statusIcon(server.status)} `}</span>
                <span {...sg(getTheme().text)}>{`${server.name}  `}</span>
                <span {...sg(getTheme().dim)}>{statusText(server)}</span>
              </text>
            )}
          </For>
        </Show>
        <text fg={getTheme().dim}>{""}</text>
        <text fg={getTheme().dim}>↑/↓ move · enter toggle · esc close</text>
      </box>
    </box>
  )
}
