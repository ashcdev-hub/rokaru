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
store.addUserMessage("list the files here and tell me what's in a.txt")
const id = store.startAssistantMessage()
store.appendText(id, "reasoning", "I'll list the directory first.\n")
store.appendText(id, "text", "Here are the files in this folder. There are a few of them and this line is long enough to test wrapping behaviour in the message area.\n")

const setup = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={8} />, { width: 120, height: 30 })
await setup.flush()
console.log("----- CHAT (120x30) -----")
console.log(setup.captureCharFrame())

store.requestPermission("bash", '{"command":"rm -rf ./dist && bun run build"}', true)
await setup.flush()
console.log("----- CHAT + PERMISSION (120x30) -----")
console.log(setup.captureCharFrame())

setup.resize(80, 24)
await setup.flush()
console.log("----- CHAT + PERMISSION (80x24) -----")
console.log(setup.captureCharFrame())

setup.renderer.destroy()
process.exit(0)
