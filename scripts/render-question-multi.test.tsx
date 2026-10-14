/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { QuestionPanel } from "../src/components/QuestionPanel"
import * as store from "../src/store"

const answer = store.requestQuestion(
  "call_multi",
  "Which files should I touch?",
  [{ label: "src/a.ts" }, { label: "src/b.ts" }, { label: "src/c.ts" }],
  true,
)
const request = store.question()!
store.toggleOption(0)
store.toggleOption(2)
store.setQuestionIndex(1)

const setup = await testRender(() => <QuestionPanel request={request} />, { width: 72, height: 14 })
await setup.flush()
const frame = setup.captureCharFrame()
console.log(frame)

const bgOf = (needle: string): string => {
  for (const line of setup.captureSpans().lines ?? []) {
    const span = (line.spans ?? []).find((s: any) => (s.text ?? "").includes(needle)) as any
    if (span) return span.bg?.buffer?.join(",") ?? "none"
  }
  return "?"
}
const checkedBg = bgOf("src/a.ts")
const cursorBg = bgOf("src/b.ts")
const otherCheckedBg = bgOf("src/c.ts")

const checks: [string, boolean][] = [
  ["shows the question", frame.includes("Which files should I touch?")],
  ["shows the selected count", frame.includes("2 selected")],
  ["checked marker", frame.includes("☑ 1. src/a.ts")],
  ["unchecked marker", frame.includes("☐ 2. src/b.ts")],
  ["submit row", frame.includes("submit (2 selected)")],
  ["no custom-answer row in multi", !frame.includes("type your own answer")],
  ["checked rows share a distinct fill", checkedBg === otherCheckedBg && checkedBg !== "none"],
  ["checked fill differs from the cursor fill", checkedBg !== cursorBg],
]

setup.renderer.destroy()
const ok = checks.every(([, v]) => v)
for (const [name, v] of checks) console.log(`${v ? "PASS" : "FAIL"}  ${name}`)
store.submitMultiQuestion()
const resolved = await answer
console.log(resolved.kind === "multi" ? `resolved: ${resolved.labels.join(", ")}` : "unexpected")
process.exit(ok ? 0 : 1)
