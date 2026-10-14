import { windowStart } from "../src/listWindow"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

check("fits → start at 0", windowStart(3, 5, 10) === 0)
check("exact fit → 0", windowStart(0, 6, 6) === 0)
check("empty → 0", windowStart(0, 0, 6) === 0)
check("zero size → 0", windowStart(3, 10, 0) === 0)
check("top clamps to 0", windowStart(0, 12, 6) === 0)
check("bottom clamps to total-size", windowStart(11, 12, 6) === 6, String(windowStart(11, 12, 6)))
check("middle centres", windowStart(6, 12, 6) === 3, String(windowStart(6, 12, 6)))
check("near top starts at 0", windowStart(2, 12, 6) === 0, String(windowStart(2, 12, 6)))
check("near bottom clamps", windowStart(9, 12, 6) === 6, String(windowStart(9, 12, 6)))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
