import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { clearSnapshots, listSnapshots, pushSnapshot, redoCount, redoLast, snapshotCount, undoLast } from "../src/undo"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const dir = mkdtempSync(join(tmpdir(), "rokaru-undo-"))
const created = join(dir, "new.txt")
const edited = join(dir, "edit.txt")

clearSnapshots()

// Creation: previous=null, current=content.
writeFileSync(created, "hello")
pushSnapshot({ path: created, previous: null, current: "hello", label: "write" })
check("snapshot counted", snapshotCount() === 1, String(snapshotCount()))

undoLast()
check("undo removes a newly created file", !existsSync(created))
check("undo moved to redo stack", redoCount() === 1 && snapshotCount() === 0)
redoLast()
check("redo restores created file", existsSync(created) && readFileSync(created, "utf8") === "hello")

// Edit: previous=v1, current=v2.
writeFileSync(edited, "v1")
pushSnapshot({ path: edited, previous: "v1", current: "v2", label: "edit" })
writeFileSync(edited, "v2")
check("push clears redo history", redoCount() === 0)
undoLast()
check("undo reverts to previous content", readFileSync(edited, "utf8") === "v1")
redoLast()
check("redo re-applies content", readFileSync(edited, "utf8") === "v2")

// Listing (most recent first).
const list = listSnapshots(10)
check("listSnapshots returns newest first", list.length === 2 && list[0].label === "edit")

let drained = 0
while (undoLast() !== undefined) drained++
check("undo drains the stack", drained === 2 && snapshotCount() === 0, `drained=${drained}`)

rmSync(dir, { recursive: true, force: true })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
