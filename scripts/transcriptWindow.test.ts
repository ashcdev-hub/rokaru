import { transcriptWindow } from "../src/transcriptWindow"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const list = [1, 2, 3, 4, 5]

const keep = transcriptWindow(list, 10, false)
check("short transcript renders in full", keep.hidden === 0 && keep.list.length === 5)

const win = transcriptWindow(list, 2, false)
check("long transcript keeps only the tail", win.hidden === 3 && win.list.length === 2)
check("window keeps the most recent items", win.list[0] === 4 && win.list[1] === 5)

check("expandAll mounts everything", transcriptWindow(list, 2, true).hidden === 0)
check("zero window disables windowing", transcriptWindow(list, 0, false).hidden === 0)
check("exactly at the limit is not windowed", transcriptWindow(list, 5, false).hidden === 0)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
