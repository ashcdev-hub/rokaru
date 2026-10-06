/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { ChatView } from "../src/components/ChatView"
import * as store from "../src/store"

store.setWorkspace("/Users/ash/dev/rokaru")
store.setModel("Ornith-1.5-35B-A3B-oQ6e-fixed-mtp")
store.setModelLimit(131072)
store.setPromptTokens(21400)
store.setContextPercent(16.3)
store.setMetrics({
  ttft: 1.5,
  tps: 27.4,
  outputTokens: 234,
  promptTokens: 21400,
  cachedTokens: 18000,
  contextLimit: 131072,
  model: "Ornith-1.5-35B-A3B-oQ6e-fixed-mtp",
})

store.addUserMessage("update the tools section of the readme")
const id = store.startAssistantMessage()
store.appendText(id, "reasoning", "The user wants the README tools section rewritten. I'll read the file then edit it.")
store.setMessageThinking(id, 4.8)
store.appendText(id, "text", "Updating the docs now.\n")

store.addToolPart(id, "call_1", "edit_file", '{"path":"~/dev/rokaru/README.md"}')
store.updateToolPart(id, "call_1", {
  status: "ok",
  result: "replaced 1 occurrence(s)",
  diff: [
    { kind: "ctx", text: "62  read_file, list_dir, glob, grep run automatically;" },
    { kind: "del", text: "63  edit_file, bash ask for permission." },
    { kind: "add", text: "63  edit_file, bash ask first. Choose always allow or deny." },
  ],
})

store.setStatus("streaming")
store.setStatusDetail("streaming")

const setup = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={6} />, { width: 100, height: 34 })
await setup.flush()
await new Promise((r) => setTimeout(r, 250))
await setup.flush()
console.log("----- COLLAPSED THOUGHT -----")
console.log(setup.captureCharFrame())

store.toggleThinking(id)
await setup.flush()
await new Promise((r) => setTimeout(r, 100))
await setup.flush()
console.log("----- EXPANDED THOUGHT -----")
console.log(setup.captureCharFrame())

setup.renderer.destroy()
process.exit(0)
