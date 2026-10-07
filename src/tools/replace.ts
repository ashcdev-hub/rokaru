import { readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { diffLines, type DiffLine } from "../diff"
import { isSensitivePath } from "../sensitive"
import { pushSnapshot } from "../undo"
import { assertWritable } from "./fs"
import type { ToolDef } from "./types"

export const REPLACE_MAX_FILES = 40
const MAX_FILE_BYTES = 1_000_000
const MAX_DIFF_LINES = 500

export interface ReplaceFilePlan {
  path: string
  before: string
  after: string
  count: number
}

export interface ReplacePlan {
  root: string
  include: string
  files: ReplaceFilePlan[]
  scanned: number
  skippedBinary: number
  skippedLarge: number
  tooMany: boolean
  total: number
}

function matcher(oldString: string, regex: boolean) {
  if (regex) {
    try {
      // Validate up front so callers get a clear error.
      new RegExp(oldString)
    } catch (err) {
      throw new Error(`invalid regex: ${(err as Error).message}`)
    }
    return {
      count(text: string): number {
        const re = new RegExp(oldString, "g")
        let n = 0
        while (re.exec(text) !== null) {
          n += 1
          if (re.lastIndex === 0) break
          if (n > 1_000_000) break
        }
        return n
      },
      apply(text: string, replacement: string): string {
        return text.replace(new RegExp(oldString, "g"), replacement)
      },
    }
  }
  return {
    count: (text: string): number => text.split(oldString).length - 1,
    apply: (text: string, replacement: string): string => text.split(oldString).join(replacement),
  }
}

// Compute the changes without touching disk. Shared by the tool and the
// permission preview so both agree on exactly what will happen.
export function planReplace(args: any, workspace: string): ReplacePlan {
  const oldString = String(args?.old_string ?? "")
  const newString = String(args?.new_string ?? "")
  const include = String(args?.include ?? "**/*")
  const base = String(args?.path ?? ".")
  const regex = Boolean(args?.regex)
  if (oldString.length === 0) throw new Error("old_string must not be empty")

  const root = base === "." || base.length === 0 ? workspace : join(workspace, base)
  const match = matcher(oldString, regex)
  const files: ReplaceFilePlan[] = []
  let scanned = 0
  let skippedBinary = 0
  let skippedLarge = 0
  let tooMany = false
  let total = 0

  const glob = new Bun.Glob(include)
  for (const rel of glob.scanSync({ cwd: root, onlyFiles: true })) {
    const full = join(root, rel)
    if (isSensitivePath(full)) continue
    let size = 0
    try {
      size = statSync(full).size
    } catch {
      continue
    }
    if (size > MAX_FILE_BYTES) {
      skippedLarge += 1
      continue
    }
    scanned += 1
    let text: string
    try {
      text = readFileSync(full, "utf8")
    } catch {
      continue
    }
    if (text.includes("\u0000")) {
      skippedBinary += 1
      continue
    }
    const count = match.count(text)
    if (count === 0) continue
    const after = match.apply(text, newString)
    if (after === text) continue
    files.push({ path: full, before: text, after, count })
    total += count
    if (files.length > REPLACE_MAX_FILES) {
      tooMany = true
      break
    }
  }

  return { root, include, files, scanned, skippedBinary, skippedLarge, tooMany, total }
}

function aggregateDiff(files: ReplaceFilePlan[]): DiffLine[] {
  const out: DiffLine[] = []
  for (const file of files) {
    out.push({ kind: "ctx", text: `--- ${file.path} ---` })
    for (const line of diffLines(file.before, file.after)) {
      out.push(line)
      if (out.length >= MAX_DIFF_LINES) {
        out.push({ kind: "ctx", text: "… (diff truncated)" })
        return out
      }
    }
  }
  return out
}

export const replaceInFilesTool: ToolDef = {
  name: "replace_in_files",
  description:
    `Replace a string across many files at once. Searches files matched by a glob (default all), replaces every ` +
    `occurrence, and stages an undo snapshot per file so /undo can revert them. Refuses if more than ${REPLACE_MAX_FILES} ` +
    `files match. Set regex to treat old_string as a regular expression.`,
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      old_string: { type: "string", description: "Text (or regular expression) to find" },
      new_string: { type: "string", description: "Replacement text" },
      include: { type: "string", description: "Glob of files to edit (default '**/*')" },
      path: { type: "string", description: "Base directory (default workspace root)" },
      regex: { type: "boolean", description: "Treat old_string as a regular expression" },
    },
    required: ["old_string", "new_string"],
  },
  async run(args, ctx) {
    const plan = planReplace(args, ctx.workspace)
    if (plan.files.length === 0) return `no matches for ${JSON.stringify(String(args?.old_string ?? ""))}`
    if (plan.tooMany) {
      throw new Error(`matched more than ${REPLACE_MAX_FILES} files; narrow \`include\` or \`path\``)
    }
    for (const file of plan.files) {
      assertWritable(ctx, file.path)
      pushSnapshot({ path: file.path, previous: file.before, current: file.after, label: "replace" })
      writeFileSync(file.path, file.after)
    }
    try {
      ctx.onDiff?.(aggregateDiff(plan.files))
    } catch {
      // diff is best-effort
    }
    return `replaced ${plan.total} occurrence(s) across ${plan.files.length} file(s)`
  },
}
