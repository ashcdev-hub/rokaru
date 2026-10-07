/** @jsxImportSource @opentui/solid */
import { getTheme, sg } from "../theme"
import { mode, model } from "../store"

export function PromptPanel(props: { height?: number; children: any }) {
  const modeLabel = () => (mode() === "plan" ? "Plan" : "Build")
  const modeColour = () => (mode() === "plan" ? getTheme().plan : getTheme().build)
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
          <text>
            <span {...sg(modeColour())}>{modeLabel()}</span>
            <span {...sg(getTheme().dim)}>{"  ·  "}</span>
            <span {...sg(getTheme().text)}>{model() || "no model"}</span>
          </text>
        </box>
      </box>
    </box>
  )
}
