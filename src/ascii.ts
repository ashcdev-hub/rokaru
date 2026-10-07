import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

export interface LogoSpan {
  text: string
  fg?: string
}

export type LogoRow = LogoSpan[]

// Fallback art, used only if the generator and any saved asset are unavailable.
// Coloured with a fresh random palette each load.
const FALLBACK_ART = [
  "██████╗  ██████╗ ██╗  ██╗ █████╗ ██████╗ ██╗   ██╗",
  "██╔══██╗██╔═══██╗██║ ██╔╝██╔══██╗██╔══██╗██║   ██║",
  "██████╔╝██║   ██║█████╔╝ ███████║██████╔╝██║   ██║",
  "██╔══██╗██║   ██║██╔═██╗ ██╔══██║██╔══██╗██║   ██║",
  "██║  ██║╚██████╔╝██║  ██╗██║  ██║██║  ██║╚██████╔╝",
  "╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ",
]

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + hue / 30) % 12
    const value = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
    return Math.round(255 * value)
  }
  return rgbToHex(f(0), f(8), f(4))
}

function randomPalette(): string[] {
  const base = Math.random() * 360
  const step = 45 + Math.random() * 75
  return [hslToHex(base, 0.85, 0.62), hslToHex(base + step, 0.9, 0.6), hslToHex(base + step * 2, 0.85, 0.58)]
}

function gradient(stops: string[], t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  const scaled = clamped * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(scaled))
  const local = scaled - i
  const [r1, g1, b1] = hexToRgb(stops[i])
  const [r2, g2, b2] = hexToRgb(stops[i + 1])
  return rgbToHex(r1 + (r2 - r1) * local, g1 + (g2 - g1) * local, b1 + (b2 - b1) * local)
}

function fallbackLogo(): LogoRow[] {
  const stops = randomPalette()
  const width = Math.max(...FALLBACK_ART.map((line) => line.length), 1)
  return trimRows(
    FALLBACK_ART.map((line, row) =>
      [...line].map((char, col) => ({ text: char, fg: gradient(stops, (col / width + row * 0.05) % 1) })),
    ),
  )
}

const BASE16 = [
  "#000000", "#cd0000", "#00cd00", "#cdcd00", "#0000ee", "#cd00cd", "#00cdcd", "#e5e5e5",
  "#7f7f7f", "#ff0000", "#00ff00", "#ffff00", "#5c5cff", "#ff00ff", "#00ffff", "#ffffff",
]

function xterm256(n: number): string {
  if (n < 16) return BASE16[n]
  if (n < 232) {
    const c = n - 16
    const levels = [0, 95, 135, 175, 215, 255]
    return rgbToHex(levels[Math.floor(c / 36) % 6], levels[Math.floor(c / 6) % 6], levels[c % 6])
  }
  const v = 8 + (n - 232) * 10
  return rgbToHex(v, v, v)
}

// Parse ANSI-coloured text into rows of colour runs. Understands truecolor
// (38;2;r;g;b), 256-colour (38;5;n), basic/bright (3x/9x), reset (0/39), and
// treats backspaces as deletions (the `script` pty wrapper emits them). All
// other escape sequences are stripped.
export function parseAnsiLogo(input: string): LogoRow[] {
  const rows: LogoRow[] = []
  let row: LogoRow = []
  let current: string | undefined
  let buffer = ""

  const flush = () => {
    if (buffer.length > 0) {
      const last = row[row.length - 1]
      if (last && last.fg === current) last.text += buffer
      else row.push({ text: buffer, fg: current })
      buffer = ""
    }
  }

  const backspace = () => {
    if (buffer.length > 0) buffer = buffer.slice(0, -1)
    else if (row.length > 0) row[row.length - 1].text = row[row.length - 1].text.slice(0, -1)
  }

  const chars = [...input]
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (ch === "\u001b") {
      if (chars[i + 1] === "[") {
        let j = i + 2
        while (j < chars.length && !/[@-~]/.test(chars[j])) j++
        const final = chars[j]
        const body = chars.slice(i + 2, j).join("")
        if (final === "m") {
          flush()
          const params = body.split(";").map((p) => (p === "" ? 0 : Number(p)))
          for (let k = 0; k < params.length; k++) {
            const p = params[k]
            if (p === 0 || p === 39) current = undefined
            else if (p === 38) {
              if (params[k + 1] === 2) {
                current = rgbToHex(params[k + 2], params[k + 3], params[k + 4])
                k += 4
              } else if (params[k + 1] === 5) {
                current = xterm256(params[k + 2])
                k += 2
              }
            } else if (p >= 30 && p <= 37) current = BASE16[p - 30]
            else if (p >= 90 && p <= 97) current = BASE16[p - 90 + 8]
          }
          i = j
          continue
        }
        i = j
        continue
      }
      if (chars[i + 1] === "]") {
        let j = i + 2
        while (j < chars.length && chars[j] !== "\u0007" && !(chars[j] === "\u001b" && chars[j + 1] === "\\")) j++
        i = j + 1
        continue
      }
      if (chars[i + 1] === "P") {
        let j = i + 2
        while (j < chars.length && !(chars[j] === "\u001b" && chars[j + 1] === "\\")) j++
        i = j + 1
        continue
      }
      i++
      continue
    }
    if (ch === "\n") {
      flush()
      rows.push(row)
      row = []
      continue
    }
    if (ch === "\r") continue
    if (ch === "\b") {
      backspace()
      continue
    }
    if (ch < " ") continue
    buffer += ch
  }
  flush()
  if (row.length > 0) rows.push(row)

  return trimRows(rows.filter((r) => r.some((s) => s.text.trim().length > 0)))
}

// Drop trailing whitespace from each row so the logo has no dead padding on the
// right (matters for horizontal centring).
function trimRows(rows: LogoRow[]): LogoRow[] {
  return rows.map((row) => {
    const spans = row.map((span) => ({ ...span }))
    while (spans.length > 0) {
      const last = spans[spans.length - 1]
      const trimmed = last.text.replace(/\s+$/, "")
      if (trimmed.length === last.text.length) break
      last.text = trimmed
      if (last.text.length === 0) spans.pop()
    }
    return spans
  })
}

let cached: LogoRow[] | undefined

// Run the user's generator through a pty (it only emits colour to a TTY) with
// `--random`, so the logo gets a different gradient every launch.
function generatedLogo(): LogoRow[] | undefined {
  try {
    const result = spawnSync(
      "/usr/bin/script",
      ["-q", "/dev/null", "cli-ascii-logo", "rokaru", "-p", "cyberpunk", "--random"],
      { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] },
    )
    if (result.status !== 0 || !result.stdout) return undefined
    const rows = parseAnsiLogo(result.stdout)
    return rows.length > 0 ? rows : undefined
  } catch {
    return undefined
  }
}

function assetLogo(): LogoRow[] | undefined {
  const root = join(import.meta.dir, "..")
  for (const path of [join(root, "assets", "ascii-logo.ans"), join(root, "assets", "ascii-logo.txt")]) {
    try {
      if (!existsSync(path)) continue
      const rows = parseAnsiLogo(readFileSync(path, "utf8"))
      if (rows.length > 0) return rows
    } catch {
      // try the next candidate
    }
  }
  return undefined
}

export function loadLogo(): LogoRow[] {
  if (!cached) {
    cached = generatedLogo() ?? assetLogo() ?? fallbackLogo()
  }
  return cached
}

// A few representative colours sampled from the logo's gradient (left → right),
// used to tint the start-screen animation so it matches the logo each load.
export function logoPalette(): string[] {
  const fgs: string[] = []
  for (const row of loadLogo()) {
    for (const span of row) {
      if (span.fg && span.text.trim().length > 0) fgs.push(span.fg)
    }
  }
  const uniq: string[] = []
  for (const colour of fgs) {
    if (uniq[uniq.length - 1] !== colour) uniq.push(colour)
  }
  if (uniq.length === 0) return []
  const pick = (t: number) => uniq[Math.max(0, Math.min(uniq.length - 1, Math.round(t * (uniq.length - 1))))]
  return [pick(0), pick(0.5), pick(1)]
}

