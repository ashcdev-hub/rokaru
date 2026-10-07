import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"
import { streamChat, type ChatMessage, type ClientOptions } from "./omlx"

// Session-derived entries oMLX may write under ~/.omlx/cache. Kept in sync with
// the allowlist rokaru's /purge-cache uses, and with oMLX's own cache layout.
export const SESSION_CACHE_ENTRIES = [
  ...Array.from({ length: 16 }, (_, i) => i.toString(16)),
  "_gdn_sidecars",
  "_boundary_snapshots",
  "response-state",
]

// Never scanned by the leak check: the model weights themselves are large and
// contain no session text, and walking them would be slow.
export const DEFAULT_EXCLUDE_DIRS = ["models"]

const SCAN_CHUNK_BYTES = 1 << 20
const MAX_SCAN_FILE_BYTES = 512 * 1024 * 1024
const CANARY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function omlxRoot(): string {
  return join(homedir(), ".omlx")
}

// A distinctive, high-entropy token that would never occur naturally, so any
// on-disk copy of it is conclusive evidence the request was persisted.
export function generateCanary(): string {
  const bytes = new Uint8Array(12)
  globalThis.crypto.getRandomValues(bytes)
  let suffix = ""
  for (const byte of bytes) suffix += CANARY_ALPHABET[byte % CANARY_ALPHABET.length]
  return `ROKARU-CANARY-${suffix}`
}

export interface ScanOptions {
  excludeDirs?: string[]
  maxFileBytes?: number
}

export interface ScanResult {
  matches: string[]
  scanned: number
  skippedLarge: string[]
}

// Recursively search files under `root` for `needle`, returning every path that
// contains it. Files larger than `maxFileBytes` are skipped and reported so the
// result can never silently claim "clean" while ignoring data.
export function scanForText(root: string, needle: string, opts: ScanOptions = {}): ScanResult {
  const absRoot = resolve(root)
  const excluded = new Set((opts.excludeDirs ?? DEFAULT_EXCLUDE_DIRS).map((dir) => resolve(absRoot, dir)))
  const maxBytes = opts.maxFileBytes ?? MAX_SCAN_FILE_BYTES
  const needleBuf = Buffer.from(needle, "utf8")
  const matches: string[] = []
  const skippedLarge: string[] = []
  let scanned = 0

  if (needleBuf.length === 0) return { matches, scanned, skippedLarge }

  const stack = [absRoot]
  while (stack.length > 0) {
    const dir = stack.pop() as string
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (excluded.has(resolve(full))) continue
        stack.push(full)
        continue
      }
      if (!entry.isFile()) continue
      let size: number
      try {
        size = statSync(full).size
      } catch {
        continue
      }
      if (size > maxBytes) {
        skippedLarge.push(full)
        continue
      }
      scanned++
      if (fileContains(full, needleBuf)) matches.push(full)
    }
  }

  matches.sort()
  return { matches, scanned, skippedLarge }
}

// Chunked search so a large file can't blow up memory. Carries the last
// needle-length-1 bytes between chunks to catch matches spanning a boundary.
function fileContains(path: string, needle: Buffer): boolean {
  let fd: number
  try {
    fd = openSync(path, "r")
  } catch {
    return false
  }
  const buf = Buffer.allocUnsafe(SCAN_CHUNK_BYTES + needle.length)
  try {
    let carry = 0
    while (true) {
      const read = readSync(fd, buf, carry, SCAN_CHUNK_BYTES, null)
      if (read <= 0) break
      const end = carry + read
      if (buf.subarray(0, end).indexOf(needle) !== -1) return true
      const keep = Math.min(needle.length - 1, end)
      if (keep > 0) buf.copy(buf, 0, end - keep, end)
      carry = keep
    }
    return false
  } catch {
    return false
  } finally {
    closeSync(fd)
  }
}

export interface DiskState {
  cacheFiles: number
  activeSessionDirs: string[]
  responseStateFiles: number
  usageDb: boolean
  stats: boolean
  hotCacheOnly: boolean | null
  usageHistory: boolean | null
}

export function collectDiskState(root: string = omlxRoot()): DiskState {
  const cacheDir = join(root, "cache")
  const activeSessionDirs = SESSION_CACHE_ENTRIES.filter((name) => dirHasFiles(join(cacheDir, name)))
  const settings = readJson(join(root, "settings.json"))
  return {
    cacheFiles: countFiles(cacheDir),
    activeSessionDirs,
    responseStateFiles: countFiles(join(cacheDir, "response-state")),
    usageDb: existsSync(join(root, "usage.sqlite3")),
    stats: existsSync(join(root, "stats.json")),
    hotCacheOnly: boolOrNull(settings?.cache?.hot_cache_only),
    usageHistory: boolOrNull(settings?.usage?.usage_history),
  }
}

function countFiles(dir: string): number {
  let total = 0
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop() as string
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile()) total++
    }
  }
  return total
}

function dirHasFiles(dir: string): boolean {
  return countFiles(dir) > 0
}

function readJson(path: string): any {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return undefined
  }
}

function boolOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function fmtBool(value: boolean | null): string {
  return value === null ? "unknown" : value ? "true" : "false"
}

export interface PrivacyReport {
  ok: boolean
  message: string
}

export function formatPrivacyReport(canary: string, scan: ScanResult, state: DiskState): PrivacyReport {
  const ok = scan.matches.length === 0 && state.activeSessionDirs.length === 0 && state.responseStateFiles === 0
  const lines: string[] = [`privacy-check ${ok ? "PASS" : "FAIL"}  (canary: ${canary})`]

  if (scan.matches.length === 0) {
    lines.push(`  ✓ canary not found in any of ${scan.scanned} file(s) scanned under ~/.omlx`)
  } else {
    lines.push(`  ✗ canary found on disk in ${scan.matches.length} file(s):`)
    for (const match of scan.matches.slice(0, 5)) lines.push(`      ${match}`)
    if (scan.matches.length > 5) lines.push(`      …and ${scan.matches.length - 5} more`)
  }

  if (state.activeSessionDirs.length === 0) {
    lines.push(`  ✓ no session cache written to disk (${state.cacheFiles} file(s) under ~/.omlx/cache)`)
  } else {
    lines.push(`  ✗ session cache written to disk: ${state.activeSessionDirs.join(", ")}`)
  }

  lines.push(`  · hot_cache_only=${fmtBool(state.hotCacheOnly)}  usage_history=${fmtBool(state.usageHistory)}`)
  lines.push(
    `  · usage.sqlite3 ${state.usageDb ? "present" : "absent"} · stats.json ${state.stats ? "present" : "absent"} · response-state ${state.responseStateFiles} file(s)`,
  )
  if (scan.skippedLarge.length > 0) {
    lines.push(`  ! skipped ${scan.skippedLarge.length} file(s) larger than 512MB`)
  }
  lines.push(
    ok
      ? "  → nothing readable was left on disk for this request."
      : "  → oMLX is persisting session-derived data; enable RAM-only cache (cache.hot_cache_only).",
  )

  return { ok, message: lines.join("\n") }
}

// Send one real request carrying the canary through oMLX. Any persistence path
// that records prompt or completion text will then contain the token, which the
// subsequent disk scan can find.
export async function sendCanaryProbe(
  opts: ClientOptions,
  model: string,
  canary: string,
  signal: AbortSignal,
): Promise<void> {
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Privacy self-test. The canary token is ${canary}. Reply with only the canary token.`,
    },
  ]
  for await (const event of streamChat(opts, { model, messages, maxTokens: 24, temperature: 0 }, signal)) {
    if (event.type === "finish") break
  }
}
