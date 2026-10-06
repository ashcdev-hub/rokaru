import { realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { SENSITIVE_DIRS, SENSITIVE_FILES } from "./sensitive"

function canonical(path: string): string | undefined {
  try {
    return realpathSync(path)
  } catch {
    return undefined
  }
}

// Allow-default (so the shell and normal tooling start cleanly) minus all
// network, with writes restricted to the workspace and temp locations.
// Later SBPL rules win, so the denies and the narrowed allow take effect.
export function buildSandboxProfile(workspace: string, extraWritePaths: string[]): string {
  const allowed = new Set<string>()
  const add = (path: string | undefined) => {
    if (path && path.length > 0) allowed.add(path)
  }

  add(canonical(workspace) ?? workspace)
  const tmp = tmpdir()
  add(tmp)
  add(canonical(tmp))
  add(`/private${tmp}`)
  add("/tmp")
  add("/private/tmp")
  add("/dev")
  for (const extra of extraWritePaths) add(canonical(extra) ?? extra)

  const rules = [...allowed].map((path) => `  (subpath ${JSON.stringify(path)})`).join("\n")

  // Read-deny protected locations (later rules win over `allow default`).
  const denies = [
    ...SENSITIVE_DIRS.map((path) => `(deny file-read* (subpath ${JSON.stringify(path)}))`),
    ...SENSITIVE_FILES.map((path) => `(deny file-read* (literal ${JSON.stringify(path)}))`),
  ].join("\n")

  return [
    "(version 1)",
    "(allow default)",
    "(deny network*)",
    "(deny file-write*)",
    `(allow file-write*\n${rules})`,
    denies,
  ].join("\n")
}
