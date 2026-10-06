import {
  addCustomTheme,
  activeThemeName,
  getTheme,
  nextTheme,
  setCurrentTheme,
  themeNames,
  THEMES,
} from "../src/theme"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

check("default theme is slate", activeThemeName() === "slate")
check("getTheme returns slate panelBg", getTheme().panelBg === THEMES.slate.panelBg)
check("names include builtins", themeNames().includes("nord") && themeNames().includes("dracula"))

check("switch to nord", setCurrentTheme("nord") === true && activeThemeName() === "nord")
check("getTheme reflects nord", getTheme().panelBg === THEMES.nord.panelBg)
check("unknown theme refused", setCurrentTheme("does-not-exist") === false)

const before = activeThemeName()
const after = nextTheme()
check("nextTheme moves and applies", after !== before && activeThemeName() === after)

const palette = { ...THEMES.slate, accent: "#123456", panelBg: "#010203" }
check("addCustomTheme succeeds", addCustomTheme("test-custom", palette) === true)
check("custom appears in names", themeNames().includes("test-custom"))
check("cannot switch to seed slate? no—custom works", setCurrentTheme("test-custom") === true)
check("custom palette applied", getTheme().accent === "#123456" && getTheme().panelBg === "#010203")
check("duplicate custom refused", addCustomTheme("test-custom", palette) === false)
check("empty name refused", addCustomTheme("   ", palette) === false)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
