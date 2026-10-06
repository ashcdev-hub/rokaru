export const HEX = {
  good: "#7bd88f",
  warn: "#ffca85",
  bad: "#ff6b6b",
  track: "#4c5566",
  dim: "#8b93a1",
  text: "#ffffff",
  accent: "#eab308",
  blue: "#4a9eff",
  tool: "#c792ea",
} as const

export const THEME = {
  text: HEX.text,
  dim: HEX.dim,
  good: HEX.good,
  warn: HEX.warn,
  bad: HEX.bad,
  track: HEX.track,
  accent: HEX.accent,
  blue: HEX.blue,
  tool: HEX.tool,
} as const

// OpenTUI colours inline text runs via the `style` prop (`style={{ fg }}`); the
// top-level `fg` prop only applies to the whole `<text>`. Spread this onto a
// `<span>` to colour a run without a type error.
export function sg(fg?: string, bg?: string): Record<string, unknown> {
  return { style: { fg, bg } }
}
