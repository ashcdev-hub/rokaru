/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { MessageList } from "../src/components/MessageList"
import * as store from "../src/store"

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1

store.addUserMessage("tell me a story")
const id = store.startAssistantMessage()
store.setStatus("streaming")

const setup = await testRender(() => <MessageList />, { width: 70, height: 20 })
await setup.flush()
await new Promise((r) => setTimeout(r, 60))

const frame = () => setup.captureCharFrame()
const assistant = (messageId: string) => store.messages().find((m) => m.id === messageId)!

store.appendStream(id, "text", "Hello ")
await setup.flush()
store.appendStream(id, "text", "brave ")
await setup.flush()
const afterTwo = frame()
const liveBufferActive = store.streamBuffer()?.text === "Hello brave "

store.appendStream(id, "text", "new ")
store.appendStream(id, "text", "world")
await setup.flush()
const full = "Hello brave new world"
const liveFrame = frame()
const partsWhileStreaming = assistant(id).parts.length

store.commitStream()
await setup.flush()
const committedFrame = frame()

const textPart = assistant(id).parts[0] as { kind: string; text: string }
const committedExactly = assistant(id).parts.length === 1 && textPart.kind === "text" && textPart.text === full

const toolId = store.startAssistantMessage()
store.appendStream(toolId, "text", "answer one")
store.commitStream()
store.addToolPart(toolId, "call_1", "read_file", "{}")
store.updateToolPart(toolId, "call_1", { status: "ok", result: "done" })
store.appendStream(toolId, "text", "answer two")
store.commitStream()
const toolParts = assistant(toolId).parts

const switchId = store.startAssistantMessage()
store.appendStream(switchId, "reasoning", "weighing it up")
store.appendStream(switchId, "text", "the verdict")
store.commitStream()
const switchParts = assistant(switchId).parts

const checks: [string, boolean][] = [
  ["live text streams into view", afterTwo.includes("Hello brave")],
  ["buffer holds the live tail", liveBufferActive],
  ["live text grows without duplicating", liveFrame.includes(full) && count(liveFrame, "brave") === 1],
  ["nothing written to parts while streaming", partsWhileStreaming === 0],
  ["commit folds buffer into one text part", committedExactly],
  ["buffer cleared after commit", store.streamBuffer() === undefined],
  ["committed text renders once", committedFrame.includes(full) && count(committedFrame, "world") === 1],
  ["tool boundary keeps order", toolParts.map((p) => p.kind).join(",") === "text,tool,text"],
  ["text around tool is intact", JSON.stringify(toolParts.filter((p) => p.kind === "text").map((p) => (p as { text: string }).text)) === JSON.stringify(["answer one", "answer two"])],
  ["kind switch commits in order", switchParts.map((p) => p.kind).join(",") === "reasoning,text"],
]

const ok = checks.every(([, v]) => v)
for (const [name, v] of checks) console.log(`${v ? "PASS" : "FAIL"}  ${name}`)
setup.renderer.destroy()
process.exit(ok ? 0 : 1)
