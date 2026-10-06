/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { ChatView } from "../src/components/ChatView"
import { SwitchModel } from "../src/components/SwitchModel"
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
store.addUserMessage("hello there")
const id = store.startAssistantMessage()
store.appendText(id, "text", "Hi! Here is some selectable text you can copy.")

store.showToast("copied to clipboard")

const chat = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={8} />, { width: 100, height: 24 })
await chat.flush()
console.log("----- CHAT + TOAST (100x24) -----")
console.log(chat.captureCharFrame())
chat.renderer.destroy()

const sw = await testRender(() => <SwitchModel baseURL="http://127.0.0.1:8000/v1" apiKey="sk-omlx-local" onSelect={() => {}} />, {
  width: 100,
  height: 24,
})
await sw.flush()
await sw.waitForFrame((frame) => frame.includes("Ornith") || frame.includes("Qwen"))
console.log("----- SWITCH MODEL (100x24) -----")
console.log(sw.captureCharFrame())
sw.renderer.destroy()

process.exit(0)
