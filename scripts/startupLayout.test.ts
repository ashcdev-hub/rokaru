import { isClearedByCentre, startupContentCols, startupContentRows } from "../src/startupLayout"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const LOGO_ROWS = 6
const r2 = startupContentRows(2, LOGO_ROWS, true)
const r4 = startupContentRows(4, LOGO_ROWS, true)
check("content grows with the model list", r4 > r2, `${r2} -> ${r4}`)
check("4-model content height", r4 === 26, String(r4))
check("picker height is capped", startupContentRows(30, LOGO_ROWS, true) === LOGO_ROWS + 7 + 16)
check("cols at least the picker width", startupContentCols(50) === 60 && startupContentCols(80) === 80)

// With 4 models on a 140x40 terminal the content block spans rows 7..32; every
// one of those rows must be inside the rain's clear rectangle, including the
// top logo row that the old fixed band left exposed.
const HEIGHT = 40
const WIDTH = 140
const cols = startupContentCols(50)
const top = Math.floor((HEIGHT - r4) / 2)
const covered = Array.from({ length: r4 }, (_, i) => top + i).every((y) => isClearedByCentre(WIDTH / 2, y, WIDTH, HEIGHT, r4, cols))
check("rain is cleared across the whole 4-model content block", covered)
check("rain still renders outside the block", !isClearedByCentre(WIDTH / 2, 0, WIDTH, HEIGHT, r4, cols))
check("rain is cleared across the content width", isClearedByCentre(WIDTH / 2 - 28, HEIGHT / 2, WIDTH, HEIGHT, r4, cols))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
