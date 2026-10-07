import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { collectPurgeTargets, removePurgeTargets } from "../src/omlxCache"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const root = join(tmpdir(), `rokaru-cache-${Date.now()}`)
const put = (rel: string, content = "x".repeat(100)) => {
  const full = join(root, rel)
  mkdirSync(join(full, ".."), { recursive: true })
  writeFileSync(full, content)
}

// Session-cache lookalikes plus things that must never be touched.
put("0/block-a.safetensors")
put("1/block-b.safetensors")
put("_gdn_sidecars/dup.safetensors")
put("_boundary_snapshots/sess/file")
put("response-state/x")
put("models/model.safetensors", "MODEL")
put("settings.json", "{}")
put("logs/server.log", "log")
put("usage.sqlite3", "db")
put("vision_features/f.safetensors", "vf")
put("stray-file", "zzz")

const targets = collectPurgeTargets(root)
const names = targets.map((t) => t.path.slice(root.length + 1)).sort()
check(
  "only session-cache dirs listed",
  JSON.stringify(names) === JSON.stringify(["0", "1", "_boundary_snapshots", "_gdn_sidecars", "response-state"]),
  names.join(","),
)
check("every target stays inside root", targets.every((t) => t.path.startsWith(root + "/")))
check("freed bytes counted", targets.reduce((s, t) => s + t.bytes, 0) === 500)

removePurgeTargets(targets)
check("session dirs removed", ["0", "1", "_gdn_sidecars", "_boundary_snapshots", "response-state"].every((d) => !existsSync(join(root, d))))
check("models untouched", existsSync(join(root, "models", "model.safetensors")))
check("settings untouched", existsSync(join(root, "settings.json")))
check("logs untouched", existsSync(join(root, "logs", "server.log")))
check("usage db untouched", existsSync(join(root, "usage.sqlite3")))
check("vision features untouched", existsSync(join(root, "vision_features", "f.safetensors")))
check("missing root yields nothing", collectPurgeTargets(join(root, "nope")).length === 0)

rmSync(root, { recursive: true, force: true })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
