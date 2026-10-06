/** @jsxImportSource @opentui/solid */
import { testRender, useSelectionHandler } from "@opentui/solid"
import { copyToClipboard } from "../src/clipboard"

let captured = ""

function Harness() {
  useSelectionHandler((selection) => {
    const text = selection.getSelectedText()
    if (text && text.trim().length > 0) {
      captured = text
      copyToClipboard(text)
    }
  })
  return (
    <box flexDirection="column">
      <text>hello selectable world</text>
      <text>second line of text</text>
    </box>
  )
}

const setup = await testRender(() => <Harness />, { width: 40, height: 6 })
setup.renderer.useMouse = true
await setup.flush()
await setup.mockMouse.drag(1, 0, 6, 0, 0)
await setup.flush()
await new Promise((resolve) => setTimeout(resolve, 250))
const result = Bun.spawnSync(["pbpaste"]).stdout.toString()
console.log("handler captured:", JSON.stringify(captured))
console.log("clipboard:", JSON.stringify(result))
setup.renderer.destroy()
process.exit(0)
