/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { getTheme, sg } from "../theme"
import { mode, model, status } from "../store"
import { Spinner } from "./anim"
import { Pill } from "./ui"

export function PromptPanel(props: { height?: number; children: any }) {
  const modeLabel = () => (mode() === "plan" ? "Plan" : "Build")
  const modeColour = () => (mode() === "plan" ? getTheme().plan : getTheme().build)
  const busy = () => status() !== "idle" && status() !== "error"
  return (
    <box
      flexDirection="column"
      flexShrink={0}
      height={props.height}
      border
      borderStyle="rounded"
      borderColor={modeColour()}
    >
      <box flexDirection="row" flexGrow={1} paddingLeft={1} paddingRight={1}>
        <box width={1} backgroundColor={modeColour()} marginRight={2} />
        <box flexDirection="column" flexGrow={1}>
          {props.children}
          <box flexDirection="row">
            <Show when={busy()}>
              <Spinner fg={modeColour()} />
              <text fg={getTheme().dim}> </text>
            </Show>
            <Pill label={modeLabel()} fg={getTheme().background} bg={modeColour()} />
            <text>
              <span {...sg(getTheme().dim)}>{"  ·  "}</span>
              <span {...sg(getTheme().text)}>{model() || "no model"}</span>
            </text>
          </box>
        </box>
      </box>
    </box>
  )
}
