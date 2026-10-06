/** @jsxImportSource @opentui/solid */
import { For } from "solid-js"
import { THEME, sg } from "../theme"
import { permissionChoice, type PermissionRequest } from "../store"

const OPTIONS = ["allow once", "deny"]

export function PermissionPrompt(props: { request: PermissionRequest }) {
  return (
    <box
      flexDirection="column"
      flexShrink={0}
      border
      borderStyle="rounded"
      borderColor={THEME.warn}
      title={`permission · ${props.request.name}`}
      paddingLeft={1}
    >
      <text fg={THEME.dim}>{props.request.args.replace(/\s+/g, " ").slice(0, 160) || "(no arguments)"}</text>
      <For each={OPTIONS}>
        {(label, index) => (
          <text fg={permissionChoice() === index() ? THEME.good : THEME.dim}>
            <span {...sg(permissionChoice() === index() ? THEME.good : THEME.dim)}>
              {`${permissionChoice() === index() ? "▶ " : "  "}${label}`}
            </span>
          </text>
        )}
      </For>
      <text fg={THEME.dim}>↑/↓ choose · enter confirm · y/n quick select</text>
    </box>
  )
}
