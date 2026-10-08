/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { PermissionBody } from "../src/components/PermissionPrompt"

const big = Array.from({ length: 300 }, (_, i) => `line ${i}`).join("\n")
const request = {
  name: "edit_file",
  args: JSON.stringify({ path: "src/theme.ts", old_string: "", new_string: big, replace_all: false }),
  destructive: true,
  resolve: () => {},
}

const setup = await testRender(() => <PermissionBody request={request} />, { width: 100, height: 30 })
await setup.flush()
const frame = setup.captureCharFrame()

const checks: [string, boolean][] = [
  ["shows the edit header", frame.includes("Edit src/theme.ts")],
  ["preview is truncated", frame.includes("more lines") && !frame.includes("line 250")],
  ["allow once is visible", frame.includes("allow once")],
  ["always allow is visible", frame.includes("always allow")],
  ["allow all tools is visible", frame.includes("allow all tools")],
  ["deny is visible", frame.includes("deny")],
]
const ok = checks.every(([, v]) => v)
for (const [name, v] of checks) console.log(`${v ? "PASS" : "FAIL"}  ${name}`)
setup.renderer.destroy()
process.exit(ok ? 0 : 1)
