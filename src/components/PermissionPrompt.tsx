/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
import { diffLines } from "../diff"
import { CodeLines, DiffView } from "./Code"
import { PERMISSION_DECISIONS, permissionChoice, type PermissionDecision, type PermissionRequest } from "../store"

const LABELS: Record<PermissionDecision, string> = {
  once: "allow once",
  always: "always allow (this session)",
  deny: "deny",
}

const MAX_LINES = 12

function parseArgs(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const SUMMARY_VERB: Record<string, string> = {
  read_file: "Read",
  list_dir: "List",
  glob: "Glob",
  grep: "Grep",
  view_image: "View",
  web_search: "Search",
  web_fetch: "Fetch",
  task: "Task",
}

function CommandPreview(props: { command: string }) {
  const lines = props.command.replace(/\s+$/, "").split("\n")
  return (
    <For each={lines}>{(line, i) => <text fg={getTheme().good}>{`${i() === 0 ? "$ " : "  "}${line}`}</text>}</For>
  )
}

function WritePreview(props: { path: string; content: string }) {
  const lines = props.content.split("\n")
  const shown = lines.slice(0, MAX_LINES)
  return (
    <>
      <text fg={getTheme().blue}>{`Write ${props.path}`}</text>
      <CodeLines lines={shown} />
      <Show when={lines.length > shown.length}>
        <text fg={getTheme().dim}>{`… (${lines.length - shown.length} more lines)`}</text>
      </Show>
    </>
  )
}

function EditPreview(props: { path: string; oldString: string; newString: string }) {
  return (
    <>
      <text fg={getTheme().blue}>{`Edit ${props.path}`}</text>
      <DiffView lines={diffLines(props.oldString, props.newString)} />
    </>
  )
}

function Summary(props: { name: string; args: any; raw: string }) {
  const verb = SUMMARY_VERB[props.name]
  const detail = props.args.path ?? props.args.pattern ?? props.args.query ?? props.args.url ?? props.args.prompt ?? ""
  return <text fg={getTheme().text}>{verb ? `${verb} ${detail}` : props.raw.replace(/\s+/g, " ").slice(0, 160)}</text>
}

export function PermissionPrompt(props: { request: PermissionRequest }) {
  const name = () => props.request.name
  const args = () => parseArgs(props.request.args)

  const labelFor = (decision: PermissionDecision): string => {
    if (decision !== "always") return LABELS[decision]
    if (name() === "bash") {
      const word = String(args().command ?? "").trim().split(/\s+/)[0]
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
      title={`permission · ${name()}`}
      paddingLeft={1}
      paddingRight={1}
    >
      <box flexDirection="column" backgroundColor={getTheme().panelBg} paddingLeft={1} paddingRight={1}>
        <Show
          when={name() === "bash"}
          fallback={
            <Show
              when={name() === "edit_file"}
              fallback={
                <Show
                  when={name() === "write_file"}
                  fallback={<Summary name={name()} args={args()} raw={props.request.args} />}
                >
                  <WritePreview path={String(args().path ?? "")} content={String(args().content ?? "")} />
                </Show>
              }
            >
              <EditPreview
                path={String(args().path ?? "")}
                oldString={String(args().old_string ?? "")}
                newString={String(args().new_string ?? "")}
              />
            </Show>
          }
        >
          <CommandPreview command={String(args().command ?? props.request.args)} />
        </Show>
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
      <text fg={getTheme().dim}>↑/↓ choose · enter confirm · y/a/n quick</text>
    </box>
  )
}
