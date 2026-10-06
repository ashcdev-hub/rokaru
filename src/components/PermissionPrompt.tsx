/** @jsxImportSource @opentui/solid */
import { For } from "solid-js"
import { getTheme, sg } from "../theme"
import { PERMISSION_DECISIONS, permissionChoice, type PermissionDecision, type PermissionRequest } from "../store"

const LABELS: Record<PermissionDecision, string> = {
  once: "allow once",
  always: "always allow (this session)",
  deny: "deny",
}

export function PermissionPrompt(props: { request: PermissionRequest }) {
  const labelFor = (decision: PermissionDecision): string => {
    if (decision !== "always") return LABELS[decision]
    if (props.request.name === "bash") {
      try {
        const args = JSON.parse(props.request.args)
        const word = String(args?.command ?? "").trim().split(/\s+/)[0]
        if (word) return `always allow “${word} …” (this session)`
      } catch {
        // fall through
      }
    }
    return LABELS.always
  }
  return (
    <box
      flexDirection="column"
      flexShrink={0}
      border
      borderStyle="rounded"
      borderColor={getTheme().warn}
      title={`permission · ${props.request.name}`}
      paddingLeft={1}
    >
      <text fg={getTheme().dim}>{props.request.args.replace(/\s+/g, " ").slice(0, 160) || "(no arguments)"}</text>
      <For each={PERMISSION_DECISIONS}>
        {(decision, index) => (
          <text fg={permissionChoice() === index() ? getTheme().good : getTheme().dim}>
            <span {...sg(permissionChoice() === index() ? getTheme().good : getTheme().dim)}>
              {`${permissionChoice() === index() ? "▶ " : "  "}${labelFor(decision)}`}
            </span>
          </text>
        )}
      </For>
      <text fg={getTheme().dim}>↑/↓ choose · enter confirm · y/a/n quick</text>
    </box>
  )
}
