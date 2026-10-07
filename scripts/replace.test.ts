import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { REPLACE_MAX_FILES, planReplace, replaceInFilesTool } from "../src/tools/replace"
import { clearSnapshots, snapshotCount } from "../src/undo"
import type { ToolContext } from "../src/tools/types"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const dir = mkdtempSync(join(tmpdir(), "rokaru-replace-"))
const put = (rel: string, content = "x") => {
  const full = join(dir, rel)
  mkdirSync(join(full, ".."), { recursive: true })
  writeFileSync(full, content)
}

put("src/a.ts", "const foo = 1\n")
put("src/b.ts", "foo foo\n")
put("docs/c.md", "foo in docs\n")

const ctx: ToolContext = { workspace: dir, extraWritePaths: [], signal: new AbortController().signal }

const plan = planReplace({ old_string: "foo", new_string: "baz", include: "**/*.ts" }, dir)
check("plan finds matching files", plan.files.length === 2, String(plan.files.length))
check("plan counts occurrences", plan.total === 3, String(plan.total))
check("plan honours the glob", plan.files.every((f) => f.path.endsWith(".ts")))

clearSnapshots()
const result = await replaceInFilesTool.run({ old_string: "foo", new_string: "baz", include: "**/*.ts" }, ctx)
check("tool reports file count", /2 file/.test(result), result)
check("file a rewritten", readFileSync(join(dir, "src/a.ts"), "utf8") === "const baz = 1\n")
check("file b rewritten", readFileSync(join(dir, "src/b.ts"), "utf8") === "baz baz\n")
check("non-matching file untouched", readFileSync(join(dir, "docs/c.md"), "utf8") === "foo in docs\n")
check("snapshot staged per file", snapshotCount() === 2, String(snapshotCount()))

const none = await replaceInFilesTool.run({ old_string: "zzz", new_string: "y" }, ctx)
check("no matches is reported", /no matches/.test(none), none)

const rx = planReplace({ old_string: "b.z", new_string: "Q", regex: true, include: "**/*.ts" }, dir)
check("regex plan matches", rx.total === 3, String(rx.total))

for (let i = 0; i < REPLACE_MAX_FILES + 2; i++) put(`many/f${i}.txt`, "hit\n")
const too = planReplace({ old_string: "hit", new_string: "x", include: "many/*.txt" }, dir)
check("plan flags too many files", too.tooMany === true)
let threw = false
try {
  await replaceInFilesTool.run({ old_string: "hit", new_string: "x", include: "many/*.txt" }, ctx)
} catch {
  threw = true
}
check("tool refuses too many files", threw)

rmSync(dir, { recursive: true, force: true })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
