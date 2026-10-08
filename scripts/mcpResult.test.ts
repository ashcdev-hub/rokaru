import { emptyResultHint } from "../src/mcpResult"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

check("empty session list gets a hint", emptyResultHint('{"sessions":[],"count":0}').includes("no items"))
check("empty array gets a hint", emptyResultHint("[]").includes("no items"))
check(
  "a populated result is left alone",
  emptyResultHint('{"sessions":[{"id":"x"}],"count":1}') === '{"sessions":[{"id":"x"}],"count":1}',
)
check("a plain object without arrays is left alone", emptyResultHint('{"ok":true}') === '{"ok":true}')
check("an empty object is left alone", emptyResultHint("{}") === "{}")
check("plain text is left alone", emptyResultHint("hello") === "hello")

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
