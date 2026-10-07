import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { TOOL_MAP, toolSchemas } from "../src/tools"
import { projectInstructions } from "../src/agent"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

// read_file pagination
const dir = mkdtempSync(join(tmpdir(), "rokaru-tools-"))
const file = join(dir, "lines.txt")
writeFileSync(file, Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n"))
const ctx = { workspace: dir, extraWritePaths: [] as string[], signal: new AbortController().signal }
const readFile = TOOL_MAP.get("read_file")!

const whole = await readFile.run({ path: "lines.txt" }, ctx)
check("read_file returns all lines", whole.includes("line 1") && whole.includes("line 20"))

const paged = await readFile.run({ path: "lines.txt", offset: 5, limit: 3 }, ctx)
check("read_file paginates", paged.includes("lines 5-7 of 20") && paged.includes("5\tline 5") && paged.includes("7\tline 7") && !paged.includes("line 8"))

// tool schemas include the subagent task tool
check("schemas: task tool present (build)", toolSchemas(true, false).some((t) => t.function.name === "task"))
check("schemas: task tool present (plan)", toolSchemas(true, true).some((t) => t.function.name === "task"))
check("schemas: bash hidden in plan", !toolSchemas(true, true).some((t) => t.function.name === "bash"))
check("schemas: question offered in build", toolSchemas(true, false).some((t) => t.function.name === "question"))
check("schemas: question offered in plan", toolSchemas(true, true).some((t) => t.function.name === "question"))

// AGENTS.md auto-load
const ws = mkdtempSync(join(tmpdir(), "rokaru-agents-"))
writeFileSync(join(ws, "AGENTS.md"), "# House rules\nAlways run tests.")
check("agents.md loaded", projectInstructions(ws).includes("Always run tests"))
const emptyWs = mkdtempSync(join(tmpdir(), "rokaru-agents-empty-"))
check("no agents.md -> empty", projectInstructions(emptyWs) === "")
rmSync(ws, { recursive: true, force: true })
rmSync(emptyWs, { recursive: true, force: true })

rmSync(dir, { recursive: true, force: true })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
