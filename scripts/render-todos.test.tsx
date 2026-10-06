/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { ChatView } from "../src/components/ChatView"
import * as store from "../src/store"

store.setWorkspace("/Users/ash/dev/rokaru")
store.setModel("Ornith-1.5-35B-A3B-oQ6e-fixed-mtp")
store.setTodos([
  { content: "read the parser", status: "completed" },
  { content: "add the tokenizer", status: "in_progress" },
  { content: "write tests", status: "pending" },
])
store.addUserMessage("refactor the parser")
const id = store.startAssistantMessage()
store.addToolPart(id, "call_1", "todo_write", '{"todos":[]}')
store.updateToolPart(id, "call_1", { status: "ok", result: "3 todos" })

const setup = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={4} />, { width: 80, height: 22 })
await setup.flush()
await new Promise((r) => setTimeout(r, 150))
await setup.flush()
const frame = setup.captureCharFrame()
console.log(frame.split("\n").slice(0, 12).join("\n"))
const ok = frame.includes("☑ read the parser") && frame.includes("▶ add the tokenizer") && frame.includes("☐ write tests")
console.log(ok ? "PASS  todo panel renders" : "FAIL  todo panel missing")
setup.renderer.destroy()
process.exit(ok ? 0 : 1)
