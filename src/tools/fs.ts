import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { diffLines } from "../diff"
import { isSensitivePath } from "../sensitive"
import { pushSnapshot } from "../undo"
import type { ToolContext, ToolDef } from "./types"

const MAX_READ_CHARS = 200_000
const MAX_MATCHES = 200

function resolvePath(ctx: ToolContext, input: string, base?: string): string {
  const root = base ? join(ctx.workspace, base) : ctx.workspace
  return isAbsolute(input) ? input : resolve(root, input)
}

export function assertWritable(ctx: ToolContext, target: string): void {
  const workspace = resolve(ctx.workspace)
  const candidate = resolve(target)
  const allowedRoots = [workspace, ...ctx.extraWritePaths.map((p) => resolve(p))]
  const ok = allowedRoots.some((root) => {
    const rel = relative(root, candidate)
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))
  })
  if (!ok) {
    throw new Error(`refused: writes are limited to the workspace (${workspace})`)
  }
}

function readFileText(ctx: ToolContext, input: string): string {
  const target = resolvePath(ctx, input ?? ".")
  if (isSensitivePath(target)) throw new Error(`refused: ${target} is in a protected location`)
  const stat = statSync(target)
  if (stat.isDirectory()) throw new Error(`${target} is a directory`)
  const text = readFileSync(target, "utf8")
  if (text.length > MAX_READ_CHARS) {
    return text.slice(0, MAX_READ_CHARS) + `\n… truncated (${text.length - MAX_READ_CHARS} more chars)`
  }
  return text
}

export const readFileTool: ToolDef = {
  name: "read_file",
  description:
    "Read a UTF-8 text file. Paths are relative to the workspace unless absolute. For large files, pass offset/limit (line numbers, 1-based) to page through.",
  destructive: false,
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to read" },
      offset: { type: "number", description: "1-based line to start at (optional)" },
      limit: { type: "number", description: "Number of lines to read (optional)" },
    },
    required: ["path"],
  },
  async run(args, ctx) {
    const target = resolvePath(ctx, String(args?.path ?? ""))
    if (isSensitivePath(target)) throw new Error(`refused: ${target} is in a protected location`)
    const stat = statSync(target)
    if (stat.isDirectory()) throw new Error(`${target} is a directory`)
    const full = readFileSync(target, "utf8")
    const offset = Number(args?.offset ?? 0)
    const limit = Number(args?.limit ?? 0)
    if (offset > 0 || limit > 0) {
      const lines = full.split("\n")
      const start = Math.max(0, offset > 0 ? offset - 1 : 0)
      const end = limit > 0 ? start + limit : lines.length
      const slice = lines.slice(start, end)
      const body = slice.map((line, i) => `${start + i + 1}\t${line}`).join("\n")
      return `lines ${start + 1}-${Math.min(end, lines.length)} of ${lines.length}:\n${body}`
    }
    if (full.length > MAX_READ_CHARS) {
      return `${full.slice(0, MAX_READ_CHARS)}\n… (truncated ${full.length - MAX_READ_CHARS} chars; use offset/limit to page)`
    }
    return full
  },
}

export const listDirTool: ToolDef = {
  name: "list_dir",
  description: "List entries in a directory. Directories are suffixed with '/'.",
  destructive: false,
  parameters: {
    type: "object",
    properties: { path: { type: "string", description: "Directory path (default workspace root)" } },
  },
  async run(args, ctx) {
    const target = resolvePath(ctx, String(args?.path ?? "."))
    if (isSensitivePath(target)) throw new Error(`refused: ${target} is in a protected location`)
    const entries = readdirSync(target, { withFileTypes: true })
    return (
      entries
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .sort()
        .join("\n") || "(empty)"
    )
  },
}

export const writeFileTool: ToolDef = {
  name: "write_file",
  description: "Create or overwrite a file with the given content.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to write" },
      content: { type: "string", description: "Full file content" },
    },
    required: ["path", "content"],
  },
  async run(args, ctx) {
    const target = resolvePath(ctx, String(args?.path ?? ""))
    assertWritable(ctx, target)
    const content = String(args?.content ?? "")
    const existed = existsSync(target)
    const previous = existed ? readFileSync(target, "utf8") : ""
    pushSnapshot({ path: target, previous: existed ? previous : null, current: content, label: "write" })
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
    try {
      ctx.onDiff?.(
        existed ? diffLines(previous, content) : content.split("\n").map((text) => ({ kind: "add" as const, text })),
      )
    } catch {
      // diff is best-effort
    }
    return `wrote ${content.length} bytes to ${target}`
  },
}

export const editFileTool: ToolDef = {
  name: "edit_file",
  description: "Replace an exact string in a file. Fails if old_string is missing or, unless replace_all is true, not unique.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to edit" },
      old_string: { type: "string", description: "Exact text to replace" },
      new_string: { type: "string", description: "Replacement text" },
      replace_all: { type: "boolean", description: "Replace every occurrence" },
    },
    required: ["path", "old_string", "new_string"],
  },
  async run(args, ctx) {
    const target = resolvePath(ctx, String(args?.path ?? ""))
    assertWritable(ctx, target)
    const oldString = String(args?.old_string ?? "")
    const newString = String(args?.new_string ?? "")
    if (oldString.length === 0) throw new Error("old_string must not be empty")
    const original = readFileSync(target, "utf8")
    const count = original.split(oldString).length - 1
    if (count === 0) throw new Error("old_string not found in file")
    const replaceAll = Boolean(args?.replace_all)
    if (count > 1 && !replaceAll) {
      throw new Error(`old_string occurs ${count} times; set replace_all or provide more context`)
    }
    const updated = replaceAll ? original.split(oldString).join(newString) : original.replace(oldString, newString)
    pushSnapshot({ path: target, previous: original, current: updated, label: "edit" })
    writeFileSync(target, updated)
    try {
      ctx.onDiff?.(diffLines(original, updated))
    } catch {
      // diff is best-effort
    }
    return `replaced ${replaceAll ? count : 1} occurrence(s) in ${target}`
  },
}

export const globTool: ToolDef = {
  name: "glob",
  description: "Find files matching a glob pattern (e.g. '**/*.ts') relative to a base directory.",
  destructive: false,
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern" },
      path: { type: "string", description: "Base directory (default workspace root)" },
    },
    required: ["pattern"],
  },
  async run(args, ctx) {
    const base = resolvePath(ctx, String(args?.path ?? "."))
    const glob = new Bun.Glob(String(args?.pattern ?? "*"))
    const out: string[] = []
    for (const match of glob.scanSync({ cwd: base, onlyFiles: true })) {
      if (isSensitivePath(join(base, match))) continue
      out.push(match)
      if (out.length >= MAX_MATCHES) break
    }
    return out.length > 0 ? out.sort().join("\n") : "(no matches)"
  },
}

export const grepTool: ToolDef = {
  name: "grep",
  description: "Search file contents with a regular expression. Returns file:line:text matches.",
  destructive: false,
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regular expression to search for" },
      include: { type: "string", description: "Glob of files to search (default '**/*')" },
      path: { type: "string", description: "Base directory (default workspace root)" },
    },
    required: ["pattern"],
  },
  async run(args, ctx) {
    let regex: RegExp
    try {
      regex = new RegExp(String(args?.pattern ?? ""))
    } catch (err) {
      throw new Error(`invalid regex: ${(err as Error).message}`)
    }
    const base = resolvePath(ctx, String(args?.path ?? "."))
    const glob = new Bun.Glob(String(args?.include ?? "**/*"))
    const results: string[] = []
    for (const rel of glob.scanSync({ cwd: base, onlyFiles: true })) {
      if (results.length >= MAX_MATCHES) break
      const full = join(base, rel)
      if (isSensitivePath(full)) continue
      try {
        if (statSync(full).size > 1_000_000) continue
        const text = readFileSync(full, "utf8")
        if (text.includes("\u0000")) continue
        const lines = text.split("\n")
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push(`${rel}:${i + 1}:${lines[i].slice(0, 300)}`)
            if (results.length >= MAX_MATCHES) break
          }
        }
      } catch {
        continue
      }
    }
    return results.length > 0 ? results.join("\n") : "(no matches)"
  },
}

export function readFileForContext(ctx: ToolContext, input: string): string {
  return readFileText(ctx, input)
}

export { existsSync }
