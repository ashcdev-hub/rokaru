/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { ChatView } from "../src/components/ChatView"
import { scrollTranscriptToMessage } from "../src/components/MessageList"
import * as store from "../src/store"

store.setModel("test-model")
store.setModelLimit(131072)

const filler = "filler ".repeat(120)
store.addUserMessage(`first message ${filler}`)
const id = store.startAssistantMessage()
store.appendText(id, "text", `second reply ${filler}`)
store.addUserMessage(`third message with UNIQUEWORD ${filler}`)

const setup = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={5} />, { width: 80, height: 24 })
await setup.flush()
await new Promise((r) => setTimeout(r, 60))
await setup.flush()

store.setFindNav({ query: "uniqueword", hits: [2], at: 0 })
const firstOffset = scrollTranscriptToMessage(0)
await setup.flush()
const topFrame = setup.captureCharFrame()

const lastOffset = scrollTranscriptToMessage(2)
await setup.flush()
const jumpedFrame = setup.captureCharFrame()

const checks: [string, boolean][] = [
  ["jump to first lands at top", firstOffset === 0 && topFrame.includes("first message")],
  ["jump to hit scrolls down", lastOffset > 0],
  ["jumped frame shows the hit", jumpedFrame.includes("UNIQUEWORD")],
  ["nav hint shows position", jumpedFrame.includes("1/1") && jumpedFrame.includes("uniqueword")],
]

const ok = checks.every(([, v]) => v)
for (const [name, v] of checks) console.log(`${v ? "PASS" : "FAIL"}  ${name}`)
setup.renderer.destroy()
process.exit(ok ? 0 : 1)
