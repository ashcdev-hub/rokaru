// A private, content-free scorecard of which model and settings work for which
// kind of task on this machine. Only aggregate counts are kept: never prompts,
// code, or any transcript content. In memory by default; optionally persisted.

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

export type TaskCategory = "fix-tests" | "refactor" | "feature" | "question" | "docs" | "other"

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  "fix-tests": "fixing tests",
  refactor: "refactoring",
  feature: "adding a feature",
  question: "answering a question",
  docs: "writing docs",
  other: "other",
}

export interface SamplingSnapshot {
  temperature: number
  repetitionPenalty: number
  topK: number
}

export interface TurnOutcome {
  category: TaskCategory
  model: string
  sampling: SamplingSnapshot
  ok: boolean
  diagnostics: "pass" | "fail" | "none"
  tokens?: number
  ms?: number
}

export interface StatRow {
  category: TaskCategory
  model: string
  sampling: SamplingSnapshot
  wins: number
  losses: number
  tokens: number
  ms: number
}

export interface Suggestion {
  model: string
  sampling: SamplingSnapshot
  winRate: number
  runs: number
}

interface Options {
  enabled: boolean
  persist: boolean
  minRuns: number
  path: string
}

const options: Options = { enabled: true, persist: false, minRuns: 3, path: "" }
const rows = new Map<string, StatRow>()
let lastKey: string | undefined

function keyOf(category: string, model: string, s: SamplingSnapshot): string {
  return `${category}|${model}|${s.temperature}|${s.repetitionPenalty}|${s.topK}`
}

// Cheap keyword classifier. Only the resulting category is kept, never the text.
export function categorize(text: string): TaskCategory {
  const t = text.toLowerCase().trim()
  if (
    /^\s*(what|why|how|where|which|who|is|are|can|could|should|would|does|do|explain|tell me|show me|give me)\b/.test(t) ||
    t.endsWith("?")
  ) {
    return "question"
  }
  if (/\b(bug|fix|failing|fails?|error|crash|broken|regression|repro|assert|spec|test|tests|coverage)\b/.test(t)) {
    return "fix-tests"
  }
  if (/\b(refactor|rename|clean ?up|tidy|extract|restructure|deduplicate|simplify|reorgani[sz]e|move|split)\b/.test(t)) {
    return "refactor"
  }
  if (/\b(docs?|readme|document|comment|changelog|jsdoc|docstring)\b/.test(t)) return "docs"
  if (/\b(add|implement|create|build|support|introduce|write|new|feature|endpoint|function|component|hook|cli|command)\b/.test(t)) {
    return "feature"
  }
  return "other"
}

export function successRate(row: StatRow): number {
  const total = row.wins + row.losses
  return total === 0 ? 0 : row.wins / total
}

export function recordTurn(outcome: TurnOutcome): void {
  if (!options.enabled || outcome.model.length === 0) return
  const key = keyOf(outcome.category, outcome.model, outcome.sampling)
  const row =
    rows.get(key) ??
    ({
      category: outcome.category,
      model: outcome.model,
      sampling: outcome.sampling,
      wins: 0,
      losses: 0,
      tokens: 0,
      ms: 0,
    } satisfies StatRow)
  const success = outcome.ok && outcome.diagnostics !== "fail"
  if (success) row.wins += 1
  else row.losses += 1
  row.tokens += outcome.tokens ?? 0
  row.ms += outcome.ms ?? 0
  rows.set(key, row)
  lastKey = key
  saveIfPersisted()
}

// The user reverted the last turn's edits: treat it as a loss.
export function markUndone(): void {
  if (!options.enabled || !lastKey) return
  const row = rows.get(lastKey)
  if (!row) return
  if (row.wins > 0) row.wins -= 1
  row.losses += 1
  saveIfPersisted()
}

export function addFeedback(kind: "good" | "bad"): void {
  if (!options.enabled || !lastKey) return
  const row = rows.get(lastKey)
  if (!row) return
  if (kind === "good") {
    if (row.losses > 0) row.losses -= 1
    row.wins += 1
  } else {
    if (row.wins > 0) row.wins -= 1
    row.losses += 1
  }
  saveIfPersisted()
}

export function lastCategory(): TaskCategory | undefined {
  if (!lastKey) return undefined
  return rows.get(lastKey)?.category
}

function candidatesFor(category: TaskCategory): StatRow[] {
  return [...rows.values()].filter((row) => row.category === category && row.wins + row.losses >= options.minRuns)
}

export function suggestion(category: TaskCategory): Suggestion | undefined {
  if (!options.enabled) return undefined
  const candidates = candidatesFor(category)
  if (candidates.length === 0) return undefined
  candidates.sort((a, b) => successRate(b) - successRate(a) || b.wins + b.losses - (a.wins + a.losses))
  const best = candidates[0]
  return {
    model: best.model,
    sampling: best.sampling,
    winRate: successRate(best),
    runs: best.wins + best.losses,
  }
}

export interface ModelSummary {
  model: string
  wins: number
  losses: number
  winRate: number
}

export function overallBest(): ModelSummary | undefined {
  const byModel = new Map<string, { wins: number; losses: number }>()
  for (const row of rows.values()) {
    const entry = byModel.get(row.model) ?? { wins: 0, losses: 0 }
    entry.wins += row.wins
    entry.losses += row.losses
    byModel.set(row.model, entry)
  }
  const summaries: ModelSummary[] = [...byModel.entries()]
    .map(([model, { wins, losses }]) => ({ model, wins, losses, winRate: wins + losses === 0 ? 0 : wins / (wins + losses) }))
    .filter((s) => s.wins + s.losses >= options.minRuns)
  if (summaries.length === 0) return undefined
  summaries.sort((a, b) => b.winRate - a.winRate || b.wins + b.losses - (a.wins + a.losses))
  return summaries[0]
}

export function scoreboard(): StatRow[] {
  return [...rows.values()].sort(
    (a, b) => a.category.localeCompare(b.category) || successRate(b) - successRate(a) || b.model.localeCompare(a.model),
  )
}

export function configure(opts: Partial<Options>): void {
  if (typeof opts.enabled === "boolean") options.enabled = opts.enabled
  if (typeof opts.persist === "boolean") options.persist = opts.persist
  if (typeof opts.minRuns === "number") options.minRuns = Math.max(1, opts.minRuns)
  if (typeof opts.path === "string") options.path = opts.path
  if (options.persist && options.path.length > 0) load()
}

export function resetLearning(): void {
  rows.clear()
  lastKey = undefined
  saveIfPersisted()
}

interface Persisted {
  version: number
  rows: StatRow[]
}

function load(): void {
  try {
    if (!existsSync(options.path)) return
    const parsed = JSON.parse(readFileSync(options.path, "utf8")) as Persisted
    if (!parsed || !Array.isArray(parsed.rows)) return
    for (const row of parsed.rows) {
      if (!row || typeof row.model !== "string" || typeof row.category !== "string") continue
      rows.set(keyOf(row.category, row.model, row.sampling), {
        category: row.category,
        model: row.model,
        sampling: row.sampling,
        wins: row.wins ?? 0,
        losses: row.losses ?? 0,
        tokens: row.tokens ?? 0,
        ms: row.ms ?? 0,
      })
    }
  } catch {
    // a corrupt or unreadable scorecard is not worth failing over
  }
}

function saveIfPersisted(): void {
  if (!options.persist || options.path.length === 0) return
  try {
    mkdirSync(dirname(options.path), { recursive: true, mode: 0o700 })
    const data: Persisted = { version: 1, rows: [...rows.values()] }
    writeFileSync(options.path, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 })
    chmodSync(options.path, 0o600)
  } catch {
    // best effort
  }
}
