import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as learning from "../src/learning"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const snap = { temperature: 1, repetitionPenalty: 1.1, topK: 20 }
const outcome = (model: string, ok: boolean, diagnostics: "pass" | "fail" | "none" = "none") => ({
  category: "fix-tests" as const,
  model,
  sampling: snap,
  ok,
  diagnostics,
})

learning.configure({ enabled: true, persist: false, minRuns: 3, path: "" })
learning.resetLearning()

check("question detected", learning.categorize("How does the prefix cache work?") === "question")
check("fix-tests detected", learning.categorize("fix the failing auth test") === "fix-tests")
check("refactor detected", learning.categorize("refactor theme.ts into modules") === "refactor")
check("docs detected", learning.categorize("update the readme and changelog") === "docs")
check("feature detected", learning.categorize("add a new command") === "feature")
check("other fallback", learning.categorize("hello there") === "other")

learning.recordTurn(outcome("A", true))
learning.recordTurn(outcome("A", true))
check("no suggestion below minRuns", learning.suggestion("fix-tests") === undefined)
learning.recordTurn(outcome("A", true))
const first = learning.suggestion("fix-tests")
check("suggestion after minRuns", first?.model === "A" && first.winRate === 1, JSON.stringify(first))

// A loss makes A worse than a clean B.
learning.recordTurn(outcome("A", false, "fail"))
learning.recordTurn(outcome("B", true))
learning.recordTurn(outcome("B", true))
learning.recordTurn(outcome("B", true))
check("a better model is preferred", learning.suggestion("fix-tests")?.model === "B")

// Feedback trains the scorecard.
learning.resetLearning()
learning.recordTurn(outcome("A", false, "fail"))
learning.recordTurn(outcome("A", false, "fail"))
learning.recordTurn(outcome("A", false, "fail"))
learning.addFeedback("good")
learning.addFeedback("good")
learning.addFeedback("good")
check("feedback lifts the score", learning.suggestion("fix-tests")?.model === "A" && learning.suggestion("fix-tests")!.winRate === 1)

// Undo counts as a loss.
learning.resetLearning()
learning.recordTurn(outcome("A", true))
learning.markUndone()
const undone = learning.scoreboard()[0]
check("undo converts a win to a loss", undone.wins === 0 && undone.losses === 1, JSON.stringify(undone))

// Overall best across categories.
learning.resetLearning()
for (let i = 0; i < 3; i++) learning.recordTurn(outcome("A", true))
for (let i = 0; i < 3; i++) learning.recordTurn(outcome("B", false, "fail"))
check("overall best ranks by win rate", learning.overallBest()?.model === "A")

// Persistence: content-free, and reloadable.
const dir = mkdtempSync(join(tmpdir(), "rokaru-learning-"))
const path = join(dir, "learning.json")
learning.configure({ enabled: true, persist: true, minRuns: 3, path })
learning.resetLearning()
for (let i = 0; i < 3; i++) learning.recordTurn(outcome("A", true))
check("persist writes a file", existsSync(path))
const parsed = JSON.parse(readFileSync(path, "utf8"))
const keys = Object.keys(parsed.rows[0]).sort()
check(
  "only aggregate fields are persisted",
  JSON.stringify(keys) === JSON.stringify(["category", "losses", "model", "ms", "sampling", "tokens", "wins"].sort()),
  keys.join(","),
)

const dir2 = mkdtempSync(join(tmpdir(), "rokaru-learning-"))
const path2 = join(dir2, "learning.json")
writeFileSync(
  path2,
  JSON.stringify({ version: 1, rows: [{ category: "docs", model: "Z", sampling: snap, wins: 5, losses: 0, tokens: 0, ms: 0 }] }),
)
learning.configure({ enabled: true, persist: true, minRuns: 3, path: path2 })
check("loads a persisted scorecard", learning.suggestion("docs")?.model === "Z", JSON.stringify(learning.suggestion("docs")))

rmSync(dir, { recursive: true, force: true })
rmSync(dir2, { recursive: true, force: true })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
