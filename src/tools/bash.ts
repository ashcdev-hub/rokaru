import { spawn } from "node:child_process"
import { buildSandboxProfile } from "../sandbox"
import type { ToolDef } from "./types"

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_OUTPUT_CHARS = 30_000

function sandboxEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const key of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TERM", "SHELL", "USER"]) {
    const value = process.env[key]
    if (value) env[key] = value
  }
  env.PAGER = "cat"
  env.GIT_PAGER = "cat"
  env.GIT_TERMINAL_PROMPT = "0"
  return env
}

export const bashTool: ToolDef = {
  name: "bash",
  description:
    "Run a shell command in the workspace. Network access is disabled and writes are limited to the workspace and temp directories.",
  destructive: true,
  parameters: {
    type: "object",
    properties: { command: { type: "string", description: "Shell command to run" } },
    required: ["command"],
  },
  async run(args, ctx) {
    const command = String(args?.command ?? "")
    if (command.trim().length === 0) throw new Error("empty command")
    const profile = buildSandboxProfile(ctx.workspace, ctx.extraWritePaths)

    return await new Promise<string>((resolvePromise, rejectPromise) => {
      const child = spawn("/usr/bin/sandbox-exec", ["-p", profile, "/bin/zsh", "-c", command], {
        cwd: ctx.workspace,
        env: sandboxEnv(),
        signal: ctx.signal,
      })

      let stdout = ""
      let stderr = ""
      const timer = setTimeout(() => child.kill("SIGKILL"), DEFAULT_TIMEOUT_MS)

      child.stdout.on("data", (chunk) => (stdout += chunk.toString()))
      child.stderr.on("data", (chunk) => (stderr += chunk.toString()))
      child.on("error", (err) => {
        clearTimeout(timer)
        rejectPromise(err)
      })
      child.on("close", (code) => {
        clearTimeout(timer)
        const combined = [stdout.trimEnd(), stderr.trimEnd() ? `[stderr]\n${stderr.trimEnd()}` : ""]
          .filter(Boolean)
          .join("\n")
        const body =
          combined.length > MAX_OUTPUT_CHARS ? `${combined.slice(0, MAX_OUTPUT_CHARS)}\n… truncated` : combined
        resolvePromise(`exit ${code}\n${body || "(no output)"}`)
      })
    })
  },
}
