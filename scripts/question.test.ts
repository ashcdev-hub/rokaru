import { requestQuestion, selectQuestionRow, submitMultiQuestion, toggleOption, selectedCount, question, answerQuestion } from "../src/store"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

// Single-select: choosing a row resolves immediately with that option.
{
  const answer = requestQuestion("c1", "Pick", [{ label: "Red" }, { label: "Blue" }])
  selectQuestionRow(1)
  const resolved = await answer
  check("single: resolves the chosen option", resolved.kind === "option" && resolved.label === "Blue")
  check("single: question cleared", question() === undefined)
  check("single: not multi", !(resolved.kind === "multi"))
}

// Multi-select: rows toggle, then submit collects the checked labels.
{
  const answer = requestQuestion("c2", "Pick many", [{ label: "A" }, { label: "B" }, { label: "C" }], true)
  check("multi: question is flagged", question()?.multiSelect === true)
  selectQuestionRow(0)
  selectQuestionRow(2)
  check("multi: selected count tracks toggles", selectedCount() === 2, String(selectedCount()))
  selectQuestionRow(0) // toggle A back off
  check("multi: toggling off decrements", selectedCount() === 1, String(selectedCount()))
  selectQuestionRow(0) // back on
  submitMultiQuestion()
  const resolved = await answer
  check(
    "multi: resolves checked labels in order",
    resolved.kind === "multi" && JSON.stringify(resolved.labels) === JSON.stringify(["A", "C"]),
    JSON.stringify(resolved),
  )
  check("multi: indices match", resolved.kind === "multi" && JSON.stringify(resolved.indices) === JSON.stringify([0, 2]))
  check("multi: selection reset after answer", selectedCount() === 0)
}

// Direct toggling helper.
{
  const answer = requestQuestion("c3", "Pick", [{ label: "X" }, { label: "Y" }], true)
  toggleOption(1)
  check("toggleOption checks an option", selectedCount() === 1)
  submitMultiQuestion()
  const resolved = await answer
  check("toggleOption feeds the answer", resolved.kind === "multi" && resolved.labels[0] === "Y")
}

// Dismiss still works.
{
  const answer = requestQuestion("c4", "Pick", [{ label: "X" }, { label: "Y" }])
  answerQuestion({ kind: "dismissed" })
  const resolved = await answer
  check("dismiss resolves", resolved.kind === "dismissed")
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
