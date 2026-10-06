import { existsSync, unlinkSync, writeFileSync } from "node:fs"

export interface Snapshot {
  path: string
  previous: string | null
  label: string
}

const MAX_SNAPSHOTS = 100
const stack: Snapshot[] = []

export function pushSnapshot(snapshot: Snapshot): void {
  stack.push(snapshot)
  if (stack.length > MAX_SNAPSHOTS) stack.shift()
}

export function clearSnapshots(): void {
  stack.length = 0
}

export function snapshotCount(): number {
  return stack.length
}

// Revert the most recent edit. Returns a human description, or undefined if
// there is nothing to undo.
export function undoLast(): string | undefined {
  const snapshot = stack.pop()
  if (!snapshot) return undefined
  try {
    if (snapshot.previous === null) {
      if (existsSync(snapshot.path)) unlinkSync(snapshot.path)
      return `removed ${snapshot.path} (was newly created)`
    }
    writeFileSync(snapshot.path, snapshot.previous)
    return `reverted ${snapshot.label} on ${snapshot.path}`
  } catch (err) {
    return `undo failed: ${(err as Error).message}`
  }
}
