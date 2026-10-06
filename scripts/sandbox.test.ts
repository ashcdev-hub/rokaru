import { TOOL_MAP } from "../src/tools"
import { bashTool } from "../src/tools/bash"
import { buildSandboxProfile } from "../src/sandbox"
import { assertLoopback, LoopbackViolation } from "../src/guard"

const ctx = { workspace: process.cwd(), extraWritePaths: [] as string[], signal: new AbortController().signal }
let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

console.log("profile:\n" + buildSandboxProfile(process.cwd(), []) + "\n")

const net = await bashTool.run({ command: "curl -s -m 3 https://example.com >/dev/null && echo ALLOWED || echo BLOCKED" }, ctx)
check("bash: external network blocked", net.includes("BLOCKED"), net.replace(/\n/g, " "))

const loop = await bashTool.run({ command: "curl -s -m 3 http://127.0.0.1:8000/v1/models >/dev/null && echo ALLOWED || echo BLOCKED" }, ctx)
check("bash: loopback blocked from tool", loop.includes("BLOCKED"), loop.replace(/\n/g, " "))

const ws = await bashTool.run({ command: "echo hi > .sandbox-probe && cat .sandbox-probe && rm -f .sandbox-probe && echo WSOK" }, ctx)
check("bash: workspace write allowed", ws.includes("WSOK"), ws.replace(/\n/g, " "))

const escape = await bashTool.run({ command: "echo hi > /Users/ash/rokaru-escape && echo ESCAPED || echo CONFINED" }, ctx)
check("bash: write outside workspace blocked", escape.includes("CONFINED"), escape.replace(/\n/g, " "))

const writeTool = TOOL_MAP.get("write_file")!
try {
  await writeTool.run({ path: "/Users/ash/rokaru-escape-2", content: "x" }, ctx)
  check("write_file: outside workspace refused", false)
} catch (err) {
  check("write_file: outside workspace refused", (err as Error).message.includes("refused"))
}

try {
  const target = "/Users/ash/rokaru-guard-probe"
  await writeTool.run({ path: target, content: "x" }, ctx)
  check("write_file: workspace allowed", false, "unexpectedly wrote outside")
} catch {
  const ok = TOOL_MAP.get("write_file")!
  const inside = await ok.run({ path: ".sandbox-write-probe", content: "hello" }, ctx)
  check("write_file: workspace allowed", inside.includes("wrote"), inside)
  await bashTool.run({ command: "rm -f .sandbox-write-probe" }, ctx)
}

let guardOk = false
try {
  assertLoopback("http://evil.example.com/v1")
} catch (err) {
  guardOk = err instanceof LoopbackViolation
}
check("guard: non-loopback refused", guardOk)

let guardLocal = false
try {
  assertLoopback("http://127.0.0.1:8000/v1")
  guardLocal = true
} catch {
  guardLocal = false
}
check("guard: loopback allowed", guardLocal)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
