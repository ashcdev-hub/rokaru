import { readFileSync } from "node:fs"
import { join } from "node:path"

// Single source of truth: the version in package.json.
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8")) as {
      version?: string
    }
    if (typeof pkg.version === "string" && pkg.version.length > 0) return pkg.version
  } catch {
    // fall through
  }
  return "0.0.0"
}

export const VERSION = readVersion()
