/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { ChatView } from "../src/components/ChatView"
import * as store from "../src/store"

store.setWorkspace("/Users/ash/dev/rokaru")
store.setModel("Ornith-1.5-35B-A3B-oQ6e-fixed-mtp")
store.setModelLimit(131072)

// Older turn (should be collapsed).
store.addUserMessage("read the tools folder please")
const a1 = store.startAssistantMessage()
store.addToolPart(a1, "t1", "read_file", '{"path":"a.ts"}')
store.updateToolPart(a1, "t1", { status: "ok", result: "contents" })
store.addToolPart(a1, "t2", "grep", '{"pattern":"foo"}')
store.updateToolPart(a1, "t2", { status: "ok", result: "a.ts:1:foo" })
store.appendText(a1, "text", "OLDER-REPLY-VISIBLE\n")
store.setMessageMeta(a1, { startedAt: Date.now() - 4200, elapsedMs: 4200, tokens: 812 })

// Newest turn (expanded).
store.addUserMessage("now update the readme")
const a2 = store.startAssistantMessage()
store.appendText(a2, "text", "NEWEST-REPLY-VISIBLE\n")
store.setStatus("idle")

const setup = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={5} />, { width: 96, height: 26 })
await setup.flush()
await new Promise((r) => setTimeout(r, 200))
await setup.flush()
const frame = setup.captureCharFrame()
console.log(frame)

const checks: [string, boolean][] = [
  ["collapsed turn shows a summary", frame.includes("you → agent") && frame.includes("2 tools")],
  ["collapsed turn shows a hint", frame.includes("click to expand")],
  ["collapsed turn hides its content", !frame.includes("OLDER-REPLY-VISIBLE")],
  ["newest turn is expanded", frame.includes("NEWEST-REPLY-VISIBLE")],
  ["turns are divided", frame.includes("━")],
]
setup.renderer.destroy()
const ok = checks.every(([, v]) => v)
for (const [name, v] of checks) console.log(`${v ? "PASS" : "FAIL"}  ${name}`)
process.exit(ok ? 0 : 1)
