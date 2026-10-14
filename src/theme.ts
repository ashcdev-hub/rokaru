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
  background: string
  panelBg: string
  panelBorder: string
}

// Built-in palettes. Custom themes get added to `THEMES` at runtime via
// addCustomTheme (session-only, like the rest of rokaru).
const BUILTIN_THEMES: Record<string, Theme> = {
  onyx: {
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
    background: "#0a0d12",
    panelBg: "#0f1319",
    panelBorder: "#2b3543",
  },
  graphite: {
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
    background: "#080b0f",
    panelBg: "#0d1117",
    panelBorder: "#21262d",
  },
  glacier: {
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
    background: "#242933",
    panelBg: "#2e3440",
    panelBorder: "#3b4252",
  },
  nocturne: {
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
    background: "#1e2029",
    panelBg: "#282a36",
    panelBorder: "#44475a",
  },
  lagoon: {
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
    background: "#001e26",
    panelBg: "#002b36",
    panelBorder: "#073642",
  },
  plum: {
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
    background: "#12111c",
    panelBg: "#191724",
    panelBorder: "#312e41",
  },
  // Maximum-contrast palette for bright rooms, projectors and low-quality
  // displays. Enabled with ui.highContrast or the NO_COLOR env var.
  contrast: {
    text: "#ffffff",
    body: "#ffffff",
    dim: "#c2cad6",
    good: "#00ff88",
    warn: "#ffd400",
    bad: "#ff5f5f",
    track: "#46536a",
    accent: "#00e5ff",
    blue: "#39b6ff",
    tool: "#d9a6ff",
    build: "#ffd400",
    plan: "#39b6ff",
    meter: "#00e5ff",
    background: "#000000",
    panelBg: "#08090c",
    panelBorder: "#8593aa",
  },
  // Warm amber on dark.
  ember: {
    text: "#f5e6d3",
    body: "#e8d5b8",
    dim: "#b09a7e",
    good: "#9ece6a",
    warn: "#f0a020",
    bad: "#f7768e",
    track: "#4a3a28",
    accent: "#ffb454",
    blue: "#7dcfff",
    tool: "#e0af68",
    build: "#ffb454",
    plan: "#7dcfff",
    meter: "#e0af68",
    background: "#1a120b",
    panelBg: "#241a10",
    panelBorder: "#4a3826",
  },
  // Soft pastel dark.
  blossom: {
    text: "#efe9f5",
    body: "#d8cfe6",
    dim: "#a99bbd",
    good: "#a6e3a1",
    warn: "#f5d6a0",
    bad: "#f2a6b3",
    track: "#443a52",
    accent: "#f5c2e7",
    blue: "#a6c8ff",
    tool: "#c9a7f5",
    build: "#a6e3a1",
    plan: "#a6c8ff",
    meter: "#c9a7f5",
    background: "#1b1720",
    panelBg: "#241f2b",
    panelBorder: "#3d3547",
  },
  // Light theme, for bright rooms / a dark-room-to-day toggle.
  daylight: {
    text: "#1b1f24",
    body: "#2b3138",
    dim: "#5c6672",
    good: "#1f7a3d",
    warn: "#9a6a00",
    bad: "#b3261e",
    track: "#c2c8d2",
    accent: "#a15c00",
    blue: "#1a56b8",
    tool: "#7b3fb0",
    build: "#b06a00",
    plan: "#1a56b8",
    meter: "#7b3fb0",
    background: "#f4f5f7",
    panelBg: "#e6e8ec",
    panelBorder: "#c2c8d2",
  },
  // High-contrast alternative: cool neon on near-black.
  grid: {
    text: "#f0f6ff",
    body: "#dbe6f3",
    dim: "#9fb0c6",
    good: "#00ff9c",
    warn: "#ffd23f",
    bad: "#ff4d6d",
    track: "#3a4a60",
    accent: "#00d0ff",
    blue: "#3aa0ff",
    tool: "#a0e0ff",
    build: "#00ff9c",
    plan: "#00d0ff",
    meter: "#00d0ff",
    background: "#05070a",
    panelBg: "#0b0f14",
    panelBorder: "#6b7d99",
  },
  // Warm after-dark glow: amber, cyan, pink and green on a deep brown-black.
  afterglow: {
    text: "#f8f8f2",
    body: "#f8f8f2",
    dim: "#75715e",
    good: "#a6e22e",
    warn: "#fd971f",
    bad: "#f92672",
    track: "#49483e",
    accent: "#e6db74",
    blue: "#66d9ef",
    tool: "#ae81ff",
    build: "#e6db74",
    plan: "#66d9ef",
    meter: "#ae81ff",
    background: "#272822",
    panelBg: "#2d2e27",
    panelBorder: "#49483e",
  },
}

// Live registry: built-ins plus any custom themes added this session.
export const THEMES: Record<string, Theme> = { ...BUILTIN_THEMES }
export const BUILTIN_THEME_NAMES = Object.keys(BUILTIN_THEMES)

const [customNames, setCustomNames] = createSignal<string[]>([])
const [themeName, setThemeName] = createSignal("onyx")
const [themeVersion, setThemeVersion] = createSignal(0)

// Reactive list of every theme name (built-in + custom), for the /themes panel.
export function themeNames(): string[] {
  return [...BUILTIN_THEME_NAMES, ...customNames()]
}

export function getTheme(): Theme {
  return THEMES[themeName()] ?? THEMES.onyx
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
  "background",
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
  "#f4f5f7",
  "#f5e6d3",
  "#efe9f5",
  "#e8d5b8",
  "#e6edf3",
  "#d8cfe6",
  "#d0d7de",
  "#c9d1d9",
  "#c2c8d2",
  "#b09a7e",
  "#a99bbd",
  "#8b93a1",
  "#7b88a1",
  "#6b7d99",
  "#5c6672",
  "#4c5566",
  "#4a3a28",
  "#3a4a60",
  "#312e41",
  "#2b3543",
  "#241a10",
  "#1b1720",
  "#1b1f24",
  "#0f1319",
  "#0b0f14",
  "#05070a",
  "#000000",
  "#eab308",
  "#ffb454",
  "#ffb86c",
  "#f6c177",
  "#f0a020",
  "#e0af68",
  "#ffca85",
  "#7bd88f",
  "#50fa7b",
  "#a3be8c",
  "#9ece6a",
  "#3fb950",
  "#00ff9c",
  "#1f7a3d",
  "#ff6b6b",
  "#f85149",
  "#f7768e",
  "#ff4d6d",
  "#b3261e",
  "#4a9eff",
  "#7fd4ff",
  "#58a6ff",
  "#81a1c1",
  "#7dcfff",
  "#a6c8ff",
  "#3aa0ff",
  "#00d0ff",
  "#1a56b8",
  "#c792ea",
  "#bc8cff",
  "#bd93f9",
  "#f5c2e7",
  "#c9a7f5",
  "#7b3fb0",
  "#9ccfd8",
  "#00e5ff",
  "#f8f8f2",
  "#75715e",
  "#f92672",
  "#fd971f",
  "#e6db74",
  "#a6e22e",
  "#66d9ef",
  "#ae81ff",
  "#49483e",
  "#272822",
]

export const THEME_ROLE_LABELS: Record<string, string> = {
  background: "terminal background",
  panelBg: "panel background",
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
// `<span>` to colour a run without a type error. `attributes` is an optional
// TextAttributes bitmask (bold/dim/strikethrough/…).
export function sg(fg?: string, bg?: string, attributes?: number): Record<string, unknown> {
  return { style: { fg, bg, attributes } }
}
