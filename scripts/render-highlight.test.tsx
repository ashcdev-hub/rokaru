/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { ChatView } from "../src/components/ChatView"
import * as store from "../src/store"

store.setWorkspace("/Users/ash/dev/rokaru")
store.setModel("Ornith-1.5-35B-A3B-oQ6e-fixed-mtp")
store.setTodos([
  { content: "scan the inbox", status: "completed" },
  { content: "update the tracker", status: "in_progress" },
  { content: "write the summary", status: "pending" },
])
store.addUserMessage("how long did the build take and what did it cost?")
const id = store.startAssistantMessage()
store.appendText(
  id,
  "text",
  "The **build** took 2.5s and cost $10. Run `bun run test` to confirm — it hit 50% cache.",
)

const setup = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={4} />, { width: 88, height: 26 })
await setup.flush()
await new Promise((r) => setTimeout(r, 300))
await setup.flush()
const frame = setup.captureCharFrame()
console.log(frame.split("\n").slice(0, 20).join("\n"))

const cap: any = setup.captureSpans()
const colours = new Set<string>()
for (const line of cap.lines ?? []) {
  for (const span of line.spans ?? []) {
    const f = span.fg?.buffer
    if (f) colours.add(`rgb(${f[0]},${f[1]},${f[2]})`)
  }
}
const hasWarn = colours.has("rgb(255,202,133)") // decorated number / bold
const hasGreen = colours.has("rgb(123,216,143)") // inline code
const ok =
  frame.includes("agent") &&
  !frame.includes("assistant") &&
  frame.includes("[✓] scan the inbox") &&
  frame.includes("[•] update the tracker") &&
  frame.includes("[ ] write the summary") &&
  hasWarn &&
  hasGreen
console.log(ok ? "PASS  agent label + sidebar todos + colours" : `FAIL  warn=${hasWarn} green=${hasGreen}`)
setup.renderer.destroy()
process.exit(ok ? 0 : 1)
