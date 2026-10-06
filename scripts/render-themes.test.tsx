/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { ThemePanel } from "../src/components/ThemePanel"
import * as store from "../src/store"
import { getTheme, setCurrentTheme } from "../src/theme"

setCurrentTheme("slate")

// List mode
store.setThemeCustom(false)
store.setThemeIndex(0)
const list = await testRender(() => <ThemePanel />, { width: 70, height: 20 })
await list.flush()
const listFrame = list.captureCharFrame()
console.log(listFrame)
const listOk =
  listFrame.includes("themes") &&
  listFrame.includes("slate") &&
  listFrame.includes("nord") &&
  listFrame.includes("new theme") &&
  listFrame.includes("✓")
list.renderer.destroy()

// Edit mode
store.setThemeDraft({ ...getTheme() })
store.setThemeCustomRole(0)
store.setThemeCustom(true)
const edit = await testRender(() => <ThemePanel />, { width: 70, height: 34 })
await edit.flush()
const editFrame = edit.captureCharFrame()
console.log(editFrame)
const editOk = editFrame.includes("new theme") && editFrame.includes("background") && editFrame.includes("accent")
edit.renderer.destroy()

// Reactivity: a component reading getTheme() must re-colour when the theme changes.
function Probe() {
  return (
    <text fg={getTheme().accent}>
      {getTheme().accent}
    </text>
  )
}
setCurrentTheme("slate")
const probe = await testRender(() => <Probe />, { width: 20, height: 2 })
await probe.flush()
const slateFg = (probe.captureSpans().lines?.[0]?.spans?.[0] as any)?.fg?.buffer
setCurrentTheme("dracula")
await probe.flush()
const draculaFg = (probe.captureSpans().lines?.[0]?.spans?.[0] as any)?.fg?.buffer
probe.renderer.destroy()
const reactive = slateFg && draculaFg && slateFg.join(",") !== draculaFg.join(",")
console.log(`reactivity: slate=${slateFg?.join(",")} dracula=${draculaFg?.join(",")} -> ${reactive}`)

console.log(
  listOk && editOk && reactive ? "PASS  theme panel renders (list + editor + reactive)" : `FAIL  list=${listOk} edit=${editOk} reactive=${reactive}`,
)
process.exit(listOk && editOk && reactive ? 0 : 1)
