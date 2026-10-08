/** @jsxImportSource @opentui/solid */
import { For, Show, createMemo } from "solid-js"
import { getTheme, sg } from "../theme"
import { diffLines } from "../diff"
import { planReplace, REPLACE_MAX_FILES } from "../tools/replace"
import { CodeLines, DiffView } from "./Code"
import {
  PERMISSION_DECISIONS,
  permissionChoice,
  workspace,
  type PermissionDecision,
  type PermissionRequest,
} from "../store"

const LABELS: Record<PermissionDecision, string> = {
  once: "allow once",
  always: "always allow (this session)",
  all: "allow all tools (this session)",
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
  const shown = lines.slice(0, MAX_LINES)
  return (
    <>
      <For each={shown}>{(line, i) => <text fg={getTheme().good}>{`${i() === 0 ? "$ " : "  "}${line}`}</text>}</For>
      <Show when={lines.length > shown.length}>
        <text fg={getTheme().dim}>{`… (${lines.length - shown.length} more lines)`}</text>
      </Show>
    </>
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
  const all = createMemo(() => diffLines(props.oldString, props.newString))
  return (
    <>
      <text fg={getTheme().blue}>{`Edit ${props.path}`}</text>
      <DiffView lines={all().slice(0, MAX_LINES)} />
      <Show when={all().length > MAX_LINES}>
        <text fg={getTheme().dim}>{`… (${all().length - MAX_LINES} more lines)`}</text>
      </Show>
    </>
  )
}

function Summary(props: { name: string; args: any; raw: string }) {
  const verb = SUMMARY_VERB[props.name]
  const detail = props.args.path ?? props.args.pattern ?? props.args.query ?? props.args.url ?? props.args.prompt ?? ""
  return <text fg={getTheme().text}>{verb ? `${verb} ${detail}` : props.raw.replace(/\s+/g, " ").slice(0, 160)}</text>
}

function ReplacePreview(props: { args: any }) {
  const plan = createMemo(() => {
    try {
      return planReplace(props.args, workspace())
    } catch {
      return undefined
    }
  })
  const files = () => plan()?.files ?? []
  return (
    <>
      <text fg={getTheme().blue}>
        {`Replace ${String(props.args.old_string ?? "").slice(0, 50)} → ${String(props.args.new_string ?? "").slice(0, 50)}`}
      </text>
      <text fg={getTheme().dim}>
        {`${files().length} file(s) · ${plan()?.total ?? 0} occurrence(s)${
          plan()?.tooMany ? ` · over the ${REPLACE_MAX_FILES}-file limit (will be refused)` : ""
        }`}
      </text>
      <Show when={files().length > 0}>
        <text fg={getTheme().dim}>{files()[0].path}</text>
        <DiffView lines={diffLines(files()[0].before, files()[0].after).slice(0, MAX_LINES)} />
      </Show>
      <Show when={files().length > 1}>
        <text fg={getTheme().dim}>{`… and ${files().length - 1} more file(s)`}</text>
      </Show>
    </>
  )
}

function McpCallPreview(props: { args: any }) {
  const tool = String(props.args.tool ?? "")
  const text = JSON.stringify(props.args.arguments ?? {}, null, 2) ?? "{}"
  const lines = text.split("\n")
  const shown = lines.slice(0, MAX_LINES)
  return (
    <>
      <text fg={getTheme().meter}>{`MCP call  ${tool}`}</text>
      <CodeLines lines={shown} />
      <Show when={lines.length > shown.length}>
        <text fg={getTheme().dim}>{`… (${lines.length - shown.length} more lines)`}</text>
      </Show>
    </>
  )
}

export function PermissionBody(props: { request: PermissionRequest }) {
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
    <>
      <text fg={getTheme().warn}>
        <b>{`permission · ${name()}`}</b>
      </text>
      <box
        flexDirection="column"
        backgroundColor={getTheme().panelBg}
        paddingLeft={1}
        paddingRight={1}
        marginTop={1}
      >
        <Show
          when={name() === "bash"}
          fallback={
            <Show
              when={name() === "edit_file"}
              fallback={
                <Show
                  when={name() === "write_file"}
                  fallback={
                    <Show
                      when={name() === "replace_in_files"}
                      fallback={
                        <Show
                          when={name() === "mcp_call"}
                          fallback={<Summary name={name()} args={args()} raw={props.request.args} />}
                        >
                          <McpCallPreview args={args()} />
                        </Show>
                      }
                    >
                      <ReplacePreview args={args()} />
                    </Show>
                  }
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
      <text fg={getTheme().dim}>↑/↓ choose · enter confirm · y/a/A/n quick</text>
    </>
  )
}
