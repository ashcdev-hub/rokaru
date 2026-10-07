import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { collectDiskState, formatPrivacyReport, scanForText } from "../src/privacyCheck"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const root = join(tmpdir(), `rokaru-privacy-${Date.now()}`)
const cleanRoot = join(tmpdir(), `rokaru-privacy-clean-${Date.now()}`)
const canary = "ROKARU-CANARY-TESTTOKEN1234"
const put = (rel: string, content = "x") => {
  const full = join(root, rel)
  mkdirSync(join(full, ".."), { recursive: true })
  writeFileSync(full, content)
}

put("settings.json", JSON.stringify({ cache: { hot_cache_only: true }, usage: { usage_history: false } }))
put("leak.txt", `before ${canary} after`)
put("models/model.safetensors", canary) // decoy that must be excluded

const scan = scanForText(root, canary)
check("finds canary in a scanned file", scan.matches.includes(join(root, "leak.txt")))
check("ignores the excluded models dir", !scan.matches.some((p) => p.includes("/models/")))

// A match straddling the 1 MiB read boundary must still be found.
const chunk = 1 << 20
put("big.bin", "x".repeat(chunk - 6) + canary + "y".repeat(20))
check("finds canary spanning a chunk boundary", scanForText(root, canary).matches.includes(join(root, "big.bin")))

// Disk state with session-derived data present.
put("cache/0/block-a.safetensors", "kv")
put("cache/response-state/rec.json", "{}")
const state = collectDiskState(root)
check("counts cache files", state.cacheFiles === 2, String(state.cacheFiles))
check(
  "detects on-disk session dirs",
  state.activeSessionDirs.includes("0") && state.activeSessionDirs.includes("response-state"),
  state.activeSessionDirs.join(","),
)
check("reads settings hot_cache_only", state.hotCacheOnly === true)
check("reads settings usage_history", state.usageHistory === false)
check("usage db reports absent", state.usageDb === false)
check("response-state file count", state.responseStateFiles === 1, String(state.responseStateFiles))

const failReport = formatPrivacyReport(canary, { matches: [], scanned: 1, skippedLarge: [] }, state)
check("report FAILs when session dirs present", failReport.ok === false)

const leakedReport = formatPrivacyReport(
  canary,
  { matches: [join(root, "leak.txt")], scanned: 3, skippedLarge: [] },
  { ...state, activeSessionDirs: [] },
)
check("report FAILs when canary is on disk", leakedReport.ok === false)
check("report names the offending file", leakedReport.message.includes("leak.txt"))

// Clean state -> pass.
mkdirSync(join(cleanRoot, "cache"), { recursive: true })
const cleanState = collectDiskState(cleanRoot)
const passReport = formatPrivacyReport(canary, { matches: [], scanned: 5, skippedLarge: [] }, cleanState)
check("report PASSes when nothing persisted", passReport.ok === true)

rmSync(root, { recursive: true, force: true })
rmSync(cleanRoot, { recursive: true, force: true })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
