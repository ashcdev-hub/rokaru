import { spawnSync } from "node:child_process"

// Read the current git branch (and whether the tree is dirty) for the workspace.
// Best-effort: returns an empty branch if this isn't a git repo.
export function detectGit(workspace: string): { branch: string; dirty: boolean } {
  try {
    const head = spawnSync("git", ["-C", workspace, "rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
      timeout: 1500,
    })
    if (head.status !== 0) return { branch: "", dirty: false }
    const branch = head.stdout.trim()
    if (branch.length === 0 || branch === "HEAD") return { branch: "", dirty: false }
    const status = spawnSync("git", ["-C", workspace, "status", "--porcelain"], { encoding: "utf8", timeout: 1500 })
    return { branch, dirty: status.status === 0 && status.stdout.trim().length > 0 }
  } catch {
    return { branch: "", dirty: false }
  }
}
