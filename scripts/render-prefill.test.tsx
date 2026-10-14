/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { ChatView } from "../src/components/ChatView"
import * as store from "../src/store"

store.setWorkspace("/Users/ash/dev/rokaru")
store.setModel("Ornith-1.5-35B-A3B-oQ6e-fixed-mtp")
store.setModelLimit(131072)
store.setStatus("thinking")
store.setTurnStartedAt(Date.now())
store.setPrefill({ total: 102623, cache: 2112, processed: 44224, timeMs: 3836 })

const setup = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={4} />, { width: 110, height: 18 })
await setup.flush()
const frame = setup.captureCharFrame()
console.log(frame)

const checks: [string, boolean][] = [
  ["shows a prefill bar", frame.includes("prefill")],
  ["shows a percentage", frame.includes("43%")],
  ["shows the token count", frame.includes("44,224") || frame.includes("44224")],
]
setup.renderer.destroy()
const ok = checks.every(([, v]) => v)
for (const [name, v] of checks) console.log(`${v ? "PASS" : "FAIL"}  ${name}`)
process.exit(ok ? 0 : 1)
