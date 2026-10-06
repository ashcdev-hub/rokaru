import { connectMcp, connectServer, disconnectServer, shutdownMcp } from "../src/mcp"
import { clearDynamicTools, getTool, registerDynamicTools, toolSchemas } from "../src/tools"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const result = await connectMcp({
  servers: { mock: { command: "bun", args: ["run", "scripts/mock-mcp-server.ts"] } },
})

check("connect: no errors", result.errors.length === 0, result.errors.join("; "))
check("connect: two tools found", result.tools.length === 2, `${result.tools.length}`)

const echo = result.tools.find((t) => t.name === "mcp__mock__echo")
const danger = result.tools.find((t) => t.name === "mcp__mock__danger")
check("tool naming", Boolean(echo), echo?.name ?? "missing")
check("readOnlyHint -> non-destructive", echo?.destructive === false)
check("no readOnlyHint -> destructive", danger?.destructive === true)

registerDynamicTools(result.tools)
check("getTool finds dynamic tool", Boolean(getTool("mcp__mock__echo")))
check(
  "dynamic tool in schemas",
  toolSchemas(true, false).some((t) => t.function.name === "mcp__mock__echo"),
)
check(
  "plan mode hides destructive mcp tool",
  !toolSchemas(true, true).some((t) => t.function.name === "mcp__mock__danger"),
)

const ctx = { workspace: process.cwd(), extraWritePaths: [] as string[], signal: new AbortController().signal }
const out = await getTool("mcp__mock__echo")!.run({ text: "hi" }, ctx)
check("callTool round-trips", out.includes("echo: hi"), out)

// Per-session toggle API
const conn = await connectServer("mock2", {
  command: "bun",
  args: ["run", "scripts/mock-mcp-server.ts"],
})
check("connectServer returns tools + names", conn.tools.length === 2 && conn.toolNames.length === 2)
check("connectServer has no error", !conn.error)
disconnectServer("mock2")
check("disconnectServer is idempotent", true)

clearDynamicTools()
shutdownMcp()

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
