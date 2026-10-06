/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { ChatView } from "../src/components/ChatView"
import * as store from "../src/store"

store.setWorkspace("/Users/ash/dev/rokaru")
store.setModel("Ornith-1.5-35B-A3B-oQ6e-fixed-mtp")
store.setModelLimit(131072)
store.setMetrics({
  ttft: 1.5,
  tps: 27.4,
  outputTokens: 234,
  promptTokens: 21400,
  cachedTokens: 18000,
  contextLimit: 131072,
  model: "Ornith-1.5-35B-A3B-oQ6e-fixed-mtp",
})
store.setContextPercent(16.3)
store.setPromptTokens(21400)

store.addUserMessage("what colours are in this image?", ["vision-test.png"])
const id = store.startAssistantMessage()
store.appendText(id, "text", "It is a red square with a blue square in the top-left.")
store.addPendingImage({ name: "~/Desktop/screenshot.png (240 KB)", dataUrl: "data:image/png;base64,AA==" })

const setup = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={8} />, { width: 100, height: 30 })
await setup.flush()
await new Promise((r) => setTimeout(r, 200))
await setup.flush()
console.log(setup.captureCharFrame())
setup.renderer.destroy()
process.exit(0)
