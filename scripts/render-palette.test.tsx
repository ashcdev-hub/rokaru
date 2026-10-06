/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { CommandPalette } from "../src/components/CommandPalette"
import * as store from "../src/store"

store.setPaletteIndex(0)
const actions = [
  { label: "/model", description: "switch model" },
  { label: "/plan", description: "read-only planning mode" },
  { label: "quit", description: "exit rokaru" },
]

const setup = await testRender(() => <CommandPalette actions={actions} onPick={() => {}} />, {
  width: 70,
  height: 14,
})
await setup.flush()
const frame = setup.captureCharFrame()
console.log(frame)
const ok = frame.includes("commands") && frame.includes("▶ /model") && frame.includes("quit")
console.log(ok ? "PASS  palette renders" : "FAIL  palette missing")
setup.renderer.destroy()
process.exit(ok ? 0 : 1)
