import { diffLines } from "../src/diff"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { TOOL_MAP } from "../src/tools"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const d = diffLines("alpha\nbeta\ngamma\ndelta\nepsilon\n", "alpha\nBETA\ngamma\ndelta\nepsilon\n")
check("edit: shows a deletion", d.some((l) => l.kind === "del" && l.text === "beta"))
check("edit: shows an addition", d.some((l) => l.kind === "add" && l.text === "BETA"))
check("edit: keeps context lines", d.some((l) => l.kind === "ctx" && l.text === "gamma"))
check("edit: identical produces no diff", diffLines("same\n", "same\n").length === 0)

const added = diffLines("", "line1\nline2\n")
check("new file: all additions", added.every((l) => l.kind === "add"))

const dir = mkdtempSync(join(tmpdir(), "rokaru-diff-"))
writeFileSync(join(dir, "f.txt"), "alpha\nbeta\ngamma\n")
let captured: { kind: string; text: string }[] = []
const ctx = {
  workspace: dir,
  extraWritePaths: [] as string[],
  signal: new AbortController().signal,
  onDiff: (d: { kind: string; text: string }[]) => (captured = d),
}
await TOOL_MAP.get("edit_file")!.run({ path: "f.txt", old_string: "beta", new_string: "BETA" }, ctx)
check(
  "edit_file emits a diff",
  captured.some((l) => l.kind === "del" && l.text === "beta") && captured.some((l) => l.kind === "add" && l.text === "BETA"),
)
rmSync(dir, { recursive: true, force: true })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
