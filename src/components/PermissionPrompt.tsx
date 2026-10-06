/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
import { diffLines } from "../diff"
import { PERMISSION_DECISIONS, permissionChoice, type PermissionDecision, type PermissionRequest } from "../store"

const LABELS: Record<PermissionDecision, string> = {
  once: "allow once",
  always: "always allow (this session)",
  deny: "deny",
}

const MAX_PREVIEW_LINES = 12

function parseArgs(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

interface PreviewLine {
  text: string
  fg: string
}

// Build a readable preview of what will run: a command block for bash, a diff
// for edits, a summary line otherwise.
function preview(name: string, argsRaw: string): PreviewLine[] {
  const theme = getTheme()
  const args = parseArgs(argsRaw)
  const lines: PreviewLine[] = []
  const push = (text: string, fg: string) => {
    if (lines.length < MAX_PREVIEW_LINES) lines.push({ text, fg })
  }

  if (name === "bash") {
    const command = String(args.command ?? argsRaw ?? "").replace(/\s+$/, "")
    const parts = command.split("\n")
    parts.forEach((line, i) => push(`${i === 0 ? "$ " : "  "}${line}`, theme.good))
    return lines
  }

  if (name === "edit_file") {
    push(`Edit ${String(args.path ?? "")}`, theme.blue)
    const diff = diffLines(String(args.old_string ?? ""), String(args.new_string ?? ""))
    for (const line of diff) {
      const marker = line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "
      push(`${marker} ${line.text}`, line.kind === "add" ? theme.good : line.kind === "del" ? theme.bad : theme.dim)
    }
    return lines
  }

  if (name === "write_file") {
    push(`Write ${String(args.path ?? "")}`, theme.blue)
    const content = String(args.content ?? "")
    for (const line of content.split("\n")) push(`+ ${line}`, theme.good)
    return lines
  }

  const summary: Record<string, string> = {
    read_file: `Read ${String(args.path ?? "")}`,
    list_dir: `List ${String(args.path ?? ".")}`,
    glob: `Glob ${String(args.pattern ?? "")}`,
    grep: `Grep ${String(args.pattern ?? "")}`,
    view_image: `View ${String(args.path ?? "")}`,
    web_search: `Search ${String(args.query ?? "")}`,
    web_fetch: `Fetch ${String(args.url ?? "")}`,
  }
  push(summary[name] ?? argsRaw.replace(/\s+/g, " ").slice(0, 160) ?? "(no arguments)", theme.text)
  return lines
}

export function PermissionPrompt(props: { request: PermissionRequest }) {
  const labelFor = (decision: PermissionDecision): string => {
    if (decision !== "always") return LABELS[decision]
    if (props.request.name === "bash") {
      const word = String(parseArgs(props.request.args)?.command ?? "").trim().split(/\s+/)[0]
      if (word) return `always allow “${word} …”`
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
      paddingRight={1}
    >
      <box flexDirection="column" backgroundColor={getTheme().panelBg} paddingLeft={1} paddingRight={1}>
        <For each={preview(props.request.name, props.request.args)}>
          {(line) => <text fg={line.fg}>{line.text}</text>}
        </For>
      </box>
      <text fg={getTheme().text}>{""}</text>
      <For each={PERMISSION_DECISIONS}>
        {(decision, index) => (
          <text fg={permissionChoice() === index() ? getTheme().good : getTheme().dim}>
            <span {...sg(permissionChoice() === index() ? getTheme().good : getTheme().dim)}>
              {`${permissionChoice() === index() ? "▶ " : "  "}${labelFor(decision)}`}
            </span>
          </text>
        )}
      </For>
      <Show when={props.request.args.length > 0}>
        <text fg={getTheme().dim}>↑/↓ choose · enter confirm · y/a/n quick</text>
      </Show>
    </box>
  )
}
