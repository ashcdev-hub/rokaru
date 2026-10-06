/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { Sidebar } from "../src/components/Sidebar"
import * as store from "../src/store"

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
store.setWorkspace("/Users/ash/dev/rokaru")

const setup = await testRender(() => <Sidebar width={34} />, { width: 40, height: 40 })
await setup.flush()
console.log("----- SIDEBAR FRAME -----")
console.log(setup.captureCharFrame())
setup.renderer.destroy()
process.exit(0)
