import type { CliRenderer } from "@opentui/core"
import { resetHistory } from "./agent"
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
    renderer?.destroy()
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
      resetHistory()
      resetSession()
    } catch {
      // ignore
    }
  })
}
