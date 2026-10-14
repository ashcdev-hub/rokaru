import { contextColour, mixHex } from "../src/gradient"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

check("mix starts at a", mixHex("#000000", "#ffffff", 0) === "#000000", mixHex("#000000", "#ffffff", 0))
check("mix ends at b", mixHex("#000000", "#ffffff", 1) === "#ffffff", mixHex("#000000", "#ffffff", 1))
check("mix midpoint", mixHex("#000000", "#ffffff", 0.5) === "#808080", mixHex("#000000", "#ffffff", 0.5))
check("mix clamps below", mixHex("#000000", "#ffffff", -3) === "#000000")
check("mix clamps above", mixHex("#000000", "#ffffff", 9) === "#ffffff")

const good = "#00ff00"
const warn = "#ffff00"
const bad = "#ff0000"
check("0% is good", contextColour(0, good, warn, bad) === good)
check("50% is warn", contextColour(50, good, warn, bad) === warn)
check("100% is bad", contextColour(100, good, warn, bad) === bad)
check("25% blends good->warn", contextColour(25, good, warn, bad) === mixHex(good, warn, 0.5))
check("negative clamps to good", contextColour(-10, good, warn, bad) === good)
check("over 100 clamps to bad", contextColour(150, good, warn, bad) === bad)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
