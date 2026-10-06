import type { CliRenderer } from "@opentui/core"
import { resetHistory } from "./agent"
import { shutdownMcp } from "./mcp"
import { resetSession } from "./store"

let exiting = false

// Zeroise the in-memory session and tear the terminal down. Nothing this
// harness held is ever written to disk, so dropping the refs is the wipe.
export function secureExit(renderer: CliRenderer | undefined, code = 0): never {
  if (exiting) process.exit(code)
  exiting = true
  try {
    resetHistory()
    resetSession()
  } catch {
    // ignore
  }
  try {
    shutdownMcp()
  } catch {
    // ignore
  }
  try {
    renderer?.destroy()
  } catch {
    // ignore
  }
  // Belt-and-braces: after leaving the alternate screen, clear the visible
  // screen and the scrollback so no part of the session lingers in the terminal.
  try {
    process.stdout.write("\u001b[2J\u001b[3J\u001b[H")
  } catch {
    // ignore
  }
  process.exit(code)
}

export function installLifecycle(renderer: CliRenderer): void {
  process.on("SIGINT", () => secureExit(renderer, 130))
  process.on("SIGTERM", () => secureExit(renderer, 143))
  process.on("SIGHUP", () => secureExit(renderer, 129))
  process.on("uncaughtException", (err) => {
    try {
      process.stderr.write(`rokaru: uncaught ${err?.stack ?? String(err)}\n`)
    } catch {
      // ignore
    }
    secureExit(renderer, 1)
  })
  process.on("unhandledRejection", (reason) => {
    try {
      process.stderr.write(`rokaru: unhandled rejection ${String(reason)}\n`)
    } catch {
      // ignore
    }
    secureExit(renderer, 1)
  })
  process.on("exit", () => {
    try {
      shutdownMcp()
      resetHistory()
      resetSession()
    } catch {
      // ignore
    }
  })
}
