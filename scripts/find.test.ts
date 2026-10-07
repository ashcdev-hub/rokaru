import {
  addUserMessage,
  appendText,
  findMessageHits,
  messageSearchText,
  startAssistantMessage,
} from "../src/store"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

addUserMessage("hello world")
const id = startAssistantMessage()
appendText(id, "text", "Needle in a haystack here")
appendText(id, "reasoning", "thinking about needle")
addUserMessage("unrelated chatter")

check("hit on assistant text", JSON.stringify(findMessageHits("needle")) === JSON.stringify([1]))
check("hit on reasoning too", findMessageHits("haystack").length === 1)
check("case-insensitive", JSON.stringify(findMessageHits("HELLO")) === JSON.stringify([0]))
check("no match", findMessageHits("zzz").length === 0)
check("empty query", findMessageHits("").length === 0)
check(
  "search text spans parts",
  messageSearchText({ id: "x", role: "assistant", parts: [{ kind: "tool", id: "t", name: "bash", args: "{}", status: "ok", result: "done" }] }).includes("bash"),
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
