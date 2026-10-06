export function formatInt(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(value)))
}

export function formatCompact(value: number): string {
  const n = Math.max(0, value)
  if (n < 1000) return String(Math.round(n))
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

export function formatSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return "--"
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
  if (seconds < 10) return `${seconds.toFixed(1)}s`
  return `${Math.round(seconds)}s`
}

export function formatRate(tps: number): string {
  if (!tps || tps <= 0) return "--"
  return `${tps.toFixed(1)} t/s`
}

export function bar(percent: number, width = 24): { filled: string; track: string } {
  const p = Math.max(0, Math.min(100, percent))
  let filled = Math.round((p / 100) * width)
  if (p > 0 && filled === 0) filled = 1
  filled = Math.max(0, Math.min(width, filled))
  return { filled: "\u2588".repeat(filled), track: "\u2591".repeat(width - filled) }
}

export interface TurnMetrics {
  ttft: number
  tps: number
  outputTokens: number
  promptTokens: number
  cachedTokens: number
  contextLimit: number
  model: string
}

export const EMPTY_METRICS: TurnMetrics = {
  ttft: 0,
  tps: 0,
  outputTokens: 0,
  promptTokens: 0,
  cachedTokens: 0,
  contextLimit: 0,
  model: "",
}
