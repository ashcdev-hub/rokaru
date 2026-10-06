import { createSignal } from "solid-js"

export interface Theme {
  text: string
  body: string
  dim: string
  good: string
  warn: string
  bad: string
  track: string
  accent: string
  blue: string
  tool: string
  build: string
  plan: string
  meter: string
  panelBg: string
  panelBorder: string
}

// Built-in palettes. Custom themes get added to `THEMES` at runtime via
// addCustomTheme (session-only, like the rest of rokaru).
const BUILTIN_THEMES: Record<string, Theme> = {
  slate: {
    text: "#ffffff",
    body: "#c9d1d9",
    dim: "#8b93a1",
    good: "#7bd88f",
    warn: "#ffca85",
    bad: "#ff6b6b",
    track: "#4c5566",
    accent: "#eab308",
    blue: "#4a9eff",
    tool: "#c792ea",
    build: "#eab308",
    plan: "#7fd4ff",
    meter: "#c792ea",
    panelBg: "#0f1319",
    panelBorder: "#2b3543",
  },
  github: {
    text: "#e6edf3",
    body: "#d0d7de",
    dim: "#8b949e",
    good: "#3fb950",
    warn: "#d29922",
    bad: "#f85149",
    track: "#30363d",
    accent: "#e3b341",
    blue: "#58a6ff",
    tool: "#bc8cff",
    build: "#e3b341",
    plan: "#58a6ff",
    meter: "#bc8cff",
    panelBg: "#0d1117",
    panelBorder: "#21262d",
  },
  nord: {
    text: "#eceff4",
    body: "#d8dee9",
    dim: "#7b88a1",
    good: "#a3be8c",
    warn: "#ebcb8b",
    bad: "#bf616a",
    track: "#4c566a",
    accent: "#ebcb8b",
    blue: "#81a1c1",
    tool: "#b48ead",
    build: "#d08770",
    plan: "#81a1c1",
    meter: "#b48ead",
    panelBg: "#2e3440",
    panelBorder: "#3b4252",
  },
  dracula: {
    text: "#f8f8f2",
    body: "#f8f8f2",
    dim: "#8b94a7",
    good: "#50fa7b",
    warn: "#f1fa8c",
    bad: "#ff5555",
    track: "#45475a",
    accent: "#ffb86c",
    blue: "#8be9fd",
    tool: "#bd93f9",
    build: "#50fa7b",
    plan: "#8be9fd",
    meter: "#bd93f9",
    panelBg: "#282a36",
    panelBorder: "#44475a",
  },
  solarized: {
    text: "#fdf6e3",
    body: "#93a1a1",
    dim: "#657b83",
    good: "#859900",
    warn: "#b58900",
    bad: "#dc322f",
    track: "#073642",
    accent: "#b58900",
    blue: "#268bd2",
    tool: "#d33682",
    build: "#268bd2",
    plan: "#268bd2",
    meter: "#d33682",
    panelBg: "#002b36",
    panelBorder: "#073642",
  },
  rosepine: {
    text: "#e0def4",
    body: "#d9c9a0",
    dim: "#908caa",
    good: "#a6e3a1",
    warn: "#f9e2af",
    bad: "#f2cdcd",
    track: "#403d52",
    accent: "#f6c177",
    blue: "#9ccfd8",
    tool: "#cba8f7",
    build: "#a6e3a1",
    plan: "#9ccfd8",
    meter: "#cba8f7",
    panelBg: "#191724",
    panelBorder: "#312e41",
  },
}

// Live registry: built-ins plus any custom themes added this session.
export const THEMES: Record<string, Theme> = { ...BUILTIN_THEMES }
export const BUILTIN_THEME_NAMES = Object.keys(BUILTIN_THEMES)

const [customNames, setCustomNames] = createSignal<string[]>([])
const [themeName, setThemeName] = createSignal("slate")
const [themeVersion, setThemeVersion] = createSignal(0)

// Reactive list of every theme name (built-in + custom), for the /themes panel.
export function themeNames(): string[] {
  return [...BUILTIN_THEME_NAMES, ...customNames()]
}

export function getTheme(): Theme {
  return THEMES[themeName()] ?? THEMES.slate
}

export function activeThemeName(): string {
  return themeName()
}

export function setCurrentTheme(name: string): boolean {
  if (!THEMES[name]) return false
  setThemeName(name)
  setThemeVersion((v) => v + 1)
  return true
}

export function nextTheme(): string {
  const names = themeNames()
  const index = names.indexOf(themeName())
  const next = names[(index + 1) % names.length]
  setThemeName(next)
  setThemeVersion((v) => v + 1)
  return next
}

// Register a custom palette for this session. Returns false if the name is taken.
export function addCustomTheme(name: string, palette: Theme): boolean {
  const key = name.trim()
  if (key.length === 0 || THEMES[key]) return false
  THEMES[key] = { ...palette }
  setCustomNames((prev) => [...prev, key])
  return true
}

// Reactive; bumped on every theme switch so cached values (the markdown
// SyntaxStyle) can be rebuilt.
export { themeVersion }

// Roles exposed in the custom-theme editor, and the colours it cycles through.
export const THEME_ROLES: (keyof Theme)[] = [
  "panelBg",
  "text",
  "body",
  "dim",
  "accent",
  "good",
  "warn",
  "bad",
  "blue",
  "tool",
  "build",
  "plan",
  "meter",
  "panelBorder",
]

export const THEME_COLOURS: string[] = [
  "#ffffff",
  "#e6edf3",
  "#d0d7de",
  "#c9d1d9",
  "#8b93a1",
  "#7b88a1",
  "#4c5566",
  "#2b3543",
  "#0f1319",
  "#000000",
  "#eab308",
  "#ffca85",
  "#ffb86c",
  "#f6c177",
  "#7bd88f",
  "#50fa7b",
  "#a3be8c",
  "#3fb950",
  "#ff6b6b",
  "#f85149",
  "#4a9eff",
  "#7fd4ff",
  "#58a6ff",
  "#81a1c1",
  "#c792ea",
  "#bc8cff",
  "#bd93f9",
  "#9ccfd8",
]

export const THEME_ROLE_LABELS: Record<string, string> = {
  panelBg: "background",
  text: "text",
  body: "body text",
  dim: "dim",
  accent: "accent",
  good: "ok / green",
  warn: "warning / amber",
  bad: "error / red",
  blue: "blue",
  tool: "tool / purple",
  build: "build mode",
  plan: "plan mode",
  meter: "progress meter",
  panelBorder: "panel border",
}

// OpenTUI colours inline text runs via the `style` prop (`style={{ fg }}`); the
// top-level `fg` prop only applies to the whole `<text>`. Spread this onto a
// `<span>` to colour a run without a type error.
export function sg(fg?: string, bg?: string): Record<string, unknown> {
  return { style: { fg, bg } }
}
