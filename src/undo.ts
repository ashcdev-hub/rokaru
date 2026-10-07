import { existsSync, unlinkSync, writeFileSync } from "node:fs"

export interface Snapshot {
  path: string
  // Content before the edit (null if the file did not exist).
  previous: string | null
  // Content after the edit (null if the file was deleted).
  current: string | null
  label: string
}

const MAX_SNAPSHOTS = 100
const undoStack: Snapshot[] = []
const redoStack: Snapshot[] = []

export function pushSnapshot(snapshot: Snapshot): void {
  undoStack.push(snapshot)
  if (undoStack.length > MAX_SNAPSHOTS) undoStack.shift()
  // A fresh edit invalidates any redo history.
  redoStack.length = 0
}

export function clearSnapshots(): void {
  undoStack.length = 0
  redoStack.length = 0
}

export function snapshotCount(): number {
  return undoStack.length
}

export function redoCount(): number {
  return redoStack.length
}

export interface SnapshotInfo {
  path: string
  label: string
}

// Most recent first, capped. Used by `/undo list`.
export function listSnapshots(limit = 10): SnapshotInfo[] {
  return undoStack
    .slice(-limit)
    .reverse()
    .map(({ path, label }) => ({ path, label }))
}

function applyContent(path: string, content: string | null): void {
  if (content === null) {
    if (existsSync(path)) unlinkSync(path)
    return
  }
  writeFileSync(path, content)
}

// Revert the most recent edit. Returns a human description, or undefined if
// there is nothing to undo.
export function undoLast(): string | undefined {
  const snapshot = undoStack.pop()
  if (!snapshot) return undefined
  try {
    applyContent(snapshot.path, snapshot.previous)
  } catch (err) {
    undoStack.push(snapshot)
    return `undo failed: ${(err as Error).message}`
  }
  redoStack.push(snapshot)
  return snapshot.previous === null
    ? `removed ${snapshot.path} (was newly created)`
    : `reverted ${snapshot.label} on ${snapshot.path}`
}

// Re-apply the most recently undone edit. Returns a human description, or
// undefined if there is nothing to redo.
export function redoLast(): string | undefined {
  const snapshot = redoStack.pop()
  if (!snapshot) return undefined
  try {
    applyContent(snapshot.path, snapshot.current)
  } catch (err) {
    redoStack.push(snapshot)
    return `redo failed: ${(err as Error).message}`
  }
  undoStack.push(snapshot)
  return snapshot.current === null
    ? `removed ${snapshot.path} (redo)`
    : `re-applied ${snapshot.label} on ${snapshot.path}`
}
