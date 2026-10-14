/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { ChatView } from "../src/components/ChatView"
import { setCurrentTheme } from "../src/theme"
import * as store from "../src/store"

setCurrentTheme("daylight")
store.setWorkspace("/Users/ash/dev/rokaru")
store.setModel("Ornith-1.5-35B-A3B-oQ6e-fixed-mtp")
store.setModelLimit(131072)
store.setPromptTokens(21400)
store.setContextPercent(16.3)
store.setSessionStartedAt(Date.now() - 90_000)
store.addUserMessage("do a thing")
const id = store.startAssistantMessage()
store.appendText(id, "text", "Sure — done.\n")

const setup = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={5} />, { width: 100, height: 26 })
await setup.flush()
const frame = setup.captureCharFrame()
console.log(frame)

const checks: [string, boolean][] = [
  ["user label present", frame.includes("you")],
  ["agent label present", frame.includes("agent")],
  ["sidebar renders", frame.includes("rokaru") && frame.includes("Session Context")],
  ["session timer shows", frame.includes("⏱")],
]
const ok = checks.every(([, v]) => v)
for (const [name, v] of checks) console.log(`${v ? "PASS" : "FAIL"}  ${name}`)
setup.renderer.destroy()
process.exit(ok ? 0 : 1)
