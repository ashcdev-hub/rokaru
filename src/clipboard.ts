import { spawn } from "node:child_process"

// Copy to the macOS pasteboard. Fire-and-forget: selection handlers can fire
// often, and a failure to copy must never disrupt the UI.
export function copyToClipboard(text: string): void {
  if (text.length === 0) return
  try {
    const child = spawn("pbcopy", [], { stdio: ["pipe", "ignore", "ignore"] })
    child.on("error", () => {})
    child.stdin.on("error", () => {})
    child.stdin.end(text)
  } catch {
    // ignore
  }
}
