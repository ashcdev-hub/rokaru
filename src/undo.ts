import { existsSync, unlinkSync, writeFileSync } from "node:fs"
import { diffLines, type DiffLine } from "./diff"
import { fileCache } from "./tools/cache"

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
  fileCache.clear()
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
    fileCache.clearFor(snapshot.path)
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
    fileCache.clearFor(snapshot.path)
  } catch (err) {
    redoStack.push(snapshot)
    return `redo failed: ${(err as Error).message}`
  }
  undoStack.push(snapshot)
  return snapshot.current === null
    ? `removed ${snapshot.path} (redo)`
    : `re-applied ${snapshot.label} on ${snapshot.path}`
}

// Aggregated view of everything edited this session (one entry per file),
// derived from the pending undo stack. Used by the /changes panel.
export interface SessionChange {
  path: string
  before: string | null
  after: string | null
  edits: number
}

export function sessionChanges(): SessionChange[] {
  const map = new Map<string, SessionChange>()
  for (const snapshot of undoStack) {
    const existing = map.get(snapshot.path)
    if (!existing) {
      map.set(snapshot.path, { path: snapshot.path, before: snapshot.previous, after: snapshot.current, edits: 1 })
    } else {
      existing.after = snapshot.current
      existing.edits += 1
    }
  }
  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path))
}

export function diffForChange(change: SessionChange): DiffLine[] {
  return diffLines(change.before ?? "", change.after ?? "")
}

// Restore a file to its pre-session content and drop its pending snapshots.
export function revertChange(path: string): boolean {
  const first = undoStack.find((snapshot) => snapshot.path === path)
  if (!first) return false
  try {
    applyContent(path, first.previous)
    fileCache.clearFor(path)
  } catch {
    return false
  }
  for (let i = undoStack.length - 1; i >= 0; i--) {
    if (undoStack[i].path === path) undoStack.splice(i, 1)
  }
  return true
}
