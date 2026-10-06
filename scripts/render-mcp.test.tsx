/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { McpPanel } from "../src/components/McpPanel"
import * as store from "../src/store"

store.setMcpPanelIndex(1)
const servers = [
  { name: "godot-ai", status: "disabled" as const, tools: 0 },
  { name: "mixamo", status: "connected" as const, tools: 8 },
  { name: "blender-mcp", status: "error" as const, tools: 0, error: "spawn failed" },
]

const setup = await testRender(() => <McpPanel servers={servers} />, { width: 80, height: 12 })
await setup.flush()
const frame = setup.captureCharFrame()
console.log(frame)
const ok =
  frame.includes("connected · 8 tools") && frame.includes("disabled") && frame.includes("error · spawn failed")
console.log(ok ? "PASS  mcp panel shows statuses" : "FAIL  mcp panel statuses missing")
setup.renderer.destroy()
process.exit(ok ? 0 : 1)
