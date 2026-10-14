import { groupTurns, turnSummary } from "../src/turns"
import type { UIMessage } from "../src/store"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const user = (id: string, text: string): UIMessage => ({ id, role: "user", parts: [{ kind: "text", text }] })
const agent = (id: string, parts: UIMessage["parts"], meta: Partial<UIMessage> = {}): UIMessage => ({
  id,
  role: "assistant",
  parts,
  ...meta,
})
const info = (id: string, text: string): UIMessage => ({ id, role: "info", parts: [{ kind: "text", text }] })

const groups = groupTurns([
  user("u1", "first"),
  agent("a1", [{ kind: "tool", id: "t1", name: "read_file", args: "{}", status: "ok", result: "x" }], {
    elapsedMs: 4200,
    tokens: 812,
  }),
  info("i1", "note"),
  user("u2", "second"),
  agent("a2", [{ kind: "text", text: "hi" }]),
])

check("two turns", groups.length === 2)
check("first turn starts at the user message", groups[0].key === "u1")
check("first turn absorbs assistant + info", groups[0].messages.length === 3)
check("second turn starts at second user", groups[1].key === "u2")
check("second turn has assistant", groups[1].messages.length === 2)

check("summary names both sides", turnSummary(groups[0].messages, (ms) => `${ms / 1000}s`) === "you → agent · 1 tool · 4.2s · 812 tok")
check("summary of a lone user turn", turnSummary([user("u3", "x")], String) === "you → …")
check("summary of a leading assistant turn", turnSummary([agent("a3", [{ kind: "text", text: "x" }])], String) === "· → agent")
check("tool counts pluralise", turnSummary([user("u", "x"), agent("a", [
  { kind: "tool", id: "1", name: "grep", args: "{}", status: "ok", result: "" },
  { kind: "tool", id: "2", name: "grep", args: "{}", status: "ok", result: "" },
])], String).includes("2 tools"))
check("empty input yields no turns", groupTurns([]).length === 0)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
