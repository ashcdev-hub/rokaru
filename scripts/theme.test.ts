import {
  addCustomTheme,
  activeThemeName,
  getTheme,
  nextTheme,
  setCurrentTheme,
  themeNames,
  THEMES,
  THEME_ROLES,
  THEME_ROLE_LABELS,
  BUILTIN_THEME_NAMES,
} from "../src/theme"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

check("default theme is onyx", activeThemeName() === "onyx")
check("getTheme returns onyx panelBg", getTheme().panelBg === THEMES.onyx.panelBg)
check("names include builtins", themeNames().includes("glacier") && themeNames().includes("nocturne"))

check("switch to glacier", setCurrentTheme("glacier") === true && activeThemeName() === "glacier")
check("getTheme reflects glacier", getTheme().panelBg === THEMES.glacier.panelBg)
check("unknown theme refused", setCurrentTheme("does-not-exist") === false)

const before = activeThemeName()
const after = nextTheme()
check("nextTheme moves and applies", after !== before && activeThemeName() === after)

const palette = { ...THEMES.onyx, accent: "#123456", panelBg: "#010203" }
check("addCustomTheme succeeds", addCustomTheme("test-custom", palette) === true)
check("custom appears in names", themeNames().includes("test-custom"))
check("cannot switch to seed onyx? no—custom works", setCurrentTheme("test-custom") === true)
check("custom palette applied", getTheme().accent === "#123456" && getTheme().panelBg === "#010203")
check("duplicate custom refused", addCustomTheme("test-custom", palette) === false)
check("empty name refused", addCustomTheme("   ", palette) === false)

const hex = /^#[0-9a-f]{6}$/i
check(
  "every builtin defines a valid background",
  BUILTIN_THEME_NAMES.every((name) => hex.test(THEMES[name].background ?? "")),
)
check(
  "background gives depth over panelBg",
  BUILTIN_THEME_NAMES.every((name) => THEMES[name].background !== THEMES[name].panelBg),
)
check("background is an editable role", THEME_ROLES.includes("background"))
check(
  "background labels are distinct",
  THEME_ROLE_LABELS.background !== THEME_ROLE_LABELS.panelBg,
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
