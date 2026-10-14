// Small colour utilities for smooth progress/gradient fills. Pure so they can
// be unit-tested without the renderer.

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "")
  const n = parseInt(clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`
}

// Linear blend between two hex colours (t: 0 → a, 1 → b).
export function mixHex(a: string, b: string, t: number): string {
  const k = clamp01(t)
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k)
}

// Green → amber → red as a value goes 0 → 50 → 100. Values past 100 clamp red.
export function contextColour(percent: number, good: string, warn: string, bad: string): string {
  const p = Math.max(0, percent)
  if (p <= 50) return mixHex(good, warn, p / 50)
  return mixHex(warn, bad, Math.min(1, (p - 50) / 50))
}
