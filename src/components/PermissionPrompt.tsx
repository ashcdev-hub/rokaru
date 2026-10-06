/** @jsxImportSource @opentui/solid */
import { For } from "solid-js"
import { THEME, sg } from "../theme"
import { PERMISSION_DECISIONS, permissionChoice, type PermissionDecision, type PermissionRequest } from "../store"

const LABELS: Record<PermissionDecision, string> = {
  once: "allow once",
  always: "always allow (this session)",
  deny: "deny",
}

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
      <For each={PERMISSION_DECISIONS}>
        {(decision, index) => (
          <text fg={permissionChoice() === index() ? THEME.good : THEME.dim}>
            <span {...sg(permissionChoice() === index() ? THEME.good : THEME.dim)}>
              {`${permissionChoice() === index() ? "▶ " : "  "}${LABELS[decision]}`}
            </span>
          </text>
        )}
      </For>
      <text fg={THEME.dim}>↑/↓ choose · enter confirm · y/a/n quick</text>
    </box>
  )
}
