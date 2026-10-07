import { existsSync, readdirSync, rmSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve, sep } from "node:path"
import { spawnSync } from "node:child_process"

// Session-derived oMLX state lives under ~/.omlx/cache while models, settings,
// logs and usage stats live elsewhere. Only the entries below may ever be
// removed by a purge: per-block KV-cache shards (0-f), duplicated sidecars,
// and per-session snapshot/state dirs. Everything else (models/, settings,
// logs, vision_features, usage DB) is never touched.
const PURGE_ENTRIES = [
  ...Array.from({ length: 16 }, (_, i) => i.toString(16)),
  "_gdn_sidecars",
  "_boundary_snapshots",
  "response-state",
]

export function omlxCacheDir(): string {
  return join(homedir(), ".omlx", "cache")
}

export interface PurgeTarget {
  path: string
  bytes: number
}

function dirSizeBytes(path: string): number {
  let total = 0
  const stack = [path]
  while (stack.length > 0) {
    const current = stack.pop() as string
    let entries: string[]
    try {
      entries = readdirSync(current)
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(current, entry)
      let stat
      try {
        stat = statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) stack.push(full)
      else total += stat.size
    }
  }
  return total
}

// Resolve the removable targets inside a cache dir. Anything not on the
// allowlist — models, settings, logs, usage DB — is never listed, so a purge
// cannot delete it even if the caller is careless.
export function collectPurgeTargets(cacheDir: string): PurgeTarget[] {
  const root = resolve(cacheDir)
  const targets: PurgeTarget[] = []
  for (const entry of PURGE_ENTRIES) {
    const path = resolve(root, entry)
    if (!path.startsWith(root + sep)) continue
    let stat
    try {
      stat = statSync(path)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue
    targets.push({ path, bytes: dirSizeBytes(path) })
  }
  return targets
}

export function removePurgeTargets(targets: PurgeTarget[]): void {
  for (const target of targets) {
    rmSync(target.path, { recursive: true, force: true })
  }
}

// True while the oMLX server process exists. Purging under a live server
// risks errors against memory-mapped files, so callers must refuse then.
// Fails closed: if detection itself errors, report running.
export function isOmlxServerRunning(): boolean {
  try {
    const result = spawnSync("/usr/bin/pgrep", ["-x", "omlx-server"], { encoding: "utf8" })
    return result.status === 0
  } catch {
    return true
  }
}

export interface PurgeResult {
  refused: boolean
  freedBytes: number
  removed: string[]
}

export function purgeOmlxSessionCache(cacheDir: string = omlxCacheDir()): PurgeResult {
  if (isOmlxServerRunning()) return { refused: true, freedBytes: 0, removed: [] }
  const targets = collectPurgeTargets(cacheDir)
  removePurgeTargets(targets)
  return {
    refused: false,
    freedBytes: targets.reduce((sum, target) => sum + target.bytes, 0),
    removed: targets.map((target) => target.path),
  }
}
