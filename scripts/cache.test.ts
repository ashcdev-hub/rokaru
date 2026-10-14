import { mkdtempSync, rmSync, unlinkSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileCache } from "../src/tools/cache"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const dir = mkdtempSync(join(tmpdir(), "rokaru-cache-"))
function make(name: string, content: string): string {
  const path = join(dir, name)
  writeFileSync(path, content)
  return path
}

fileCache.clear()

// Misses and round-trips
check("uncached path is a miss", fileCache.get(join(dir, "missing.txt")) === null)
{
  const path = make("roundtrip.txt", "hello world")
  fileCache.set(path, "hello world")
  check("set then get round-trips", fileCache.get(path) === "hello world")
  check("get returns the cached content verbatim", fileCache.get(path) === "hello world")
}

// Stale mtime invalidates the entry
{
  const path = make("stale.txt", "v1")
  fileCache.set(path, "v1")
  check("fresh entry hits", fileCache.get(path) === "v1")
  const future = new Date(Date.now() + 5000)
  utimesSync(path, future, future)
  check("changed mtime is a miss", fileCache.get(path) === null)
  // Re-caching after the change works again
  fileCache.set(path, "v2")
  check("re-cached after change hits", fileCache.get(path) === "v2")
}

// Deleted file invalidates
{
  const path = make("deleted.txt", "gone soon")
  fileCache.set(path, "gone soon")
  check("entry present before delete", fileCache.get(path) === "gone soon")
  unlinkSync(path)
  check("deleted file is a miss", fileCache.get(path) === null)
}

// Single-entry eviction
{
  const keep = make("keep.txt", "keep")
  const drop = make("drop.txt", "drop")
  fileCache.set(keep, "keep")
  fileCache.set(drop, "drop")
  fileCache.clearFor(drop)
  check("clearFor keeps the other entry", fileCache.get(keep) === "keep")
  check("clearFor evicts the target", fileCache.get(drop) === null)
}

// clear()
{
  const a = make("clear-all-a.txt", "a")
  const b = make("clear-all-b.txt", "b")
  fileCache.set(a, "a")
  fileCache.set(b, "b")
  fileCache.clear()
  check("clear drops every entry", fileCache.get(a) === null && fileCache.get(b) === null)
}

// LRU eviction at the 100-entry cap
{
  fileCache.clear()
  const MAX = 100
  const paths: string[] = []
  for (let i = 0; i < MAX + 1; i++) {
    const path = make(`evict-${i}.txt`, `content ${i}`)
    paths.push(path)
    fileCache.set(path, `content ${i}`)
  }
  check("oldest entry evicted at the cap", fileCache.get(paths[0]) === null)
  check("newest entry retained at the cap", fileCache.get(paths[MAX]) === `content ${MAX}`)
}

// Touching protects an entry from eviction
{
  fileCache.clear()
  const MAX = 100
  const paths: string[] = []
  for (let i = 0; i < MAX; i++) {
    const path = make(`touch-${i}.txt`, `content ${i}`)
    paths.push(path)
    fileCache.set(path, `content ${i}`)
  }
  // Touch entry 1 so it is no longer the least-recently-used.
  fileCache.get(paths[1])
  const overflow = make("touch-overflow.txt", "overflow")
  fileCache.set(overflow, "overflow")
  check("least-recently-used entry evicted", fileCache.get(paths[0]) === null)
  check("touched entry survives eviction", fileCache.get(paths[1]) === "content 1")
}

rmSync(dir, { recursive: true, force: true })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
