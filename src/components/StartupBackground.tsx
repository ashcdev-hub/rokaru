/** @jsxImportSource @opentui/solid */
import { For, createSignal, onCleanup, onMount } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { getTheme } from "../theme"
import { logoPalette } from "../ascii"
import { isClearedByCentre } from "../startupLayout"

// Single-width glyphs so column alignment is preserved.
const GLYPHS = "01<>|/\\+=*:-·•".split("")
const TRAIL = 3
const TICK_MS = 33 // ~30fps for smooth, sub-cell motion

interface Drop {
  col: number
  y: number
  speed: number
  glyphs: string[]
}

function makeDrop(width: number, height: number, anywhere: boolean): Drop {
  return {
    col: Math.floor(Math.random() * Math.max(1, width)),
    y: anywhere ? Math.random() * height : -Math.random() * height - TRAIL,
    speed: 0.4 + Math.random() * 0.9,
    glyphs: Array.from({ length: TRAIL + 1 }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]),
  }
}

function fadeColour(palette: string[], distance: number): string {
  const t = getTheme()
  if (palette.length >= 3) {
    if (distance === 0) return palette[2]
    if (distance === 1) return palette[1]
    if (distance === 2) return palette[0]
    return t.track
  }
  if (distance <= 1) return t.good
  if (distance === 2) return t.dim
  return t.track
}

// Digital "matrix rain": columns of glyphs falling with a fading trail. Rendered
// as a fixed pool of renderables (created once) so the content layered on top
// stays above it; the rain shows through the gaps in the logo.
//
// `clearRows`/`clearCols` are the size of the centred content block. The rain is
// suppressed in a matching rectangle so it never draws over the logo or the
// model list (the select renderable doesn't reliably draw above the animation),
// and the clearance follows the content as the model list grows.
export function StartupBackground(props: { clearRows?: number; clearCols?: number } = {}) {
  const dimensions = useTerminalDimensions()
  const width = () => dimensions()?.width ?? 80
  const height = () => dimensions()?.height ?? 24
  const pool = Math.max(16, Math.min(48, Math.round(width() / 2.5)))
  const ids = Array.from({ length: pool }, (_, i) => i)
  const trailOffsets = Array.from({ length: TRAIL + 1 }, (_, i) => i)
  const palette = logoPalette()

  // Seed synchronously so the rain renderables are created *before* the content
  // layered on top of them (otherwise onMount would append them above it).
  const [drops, setDrops] = createSignal<Drop[]>(ids.map(() => makeDrop(width(), height(), true)))

  // Keep the rain clear of the centred content so the model list stays readable
  // (the select renderable doesn't reliably draw above animated overlays). The
  // half-extents track the content size with a small margin.
  const inCentre = (x: number, y: number): boolean =>
    isClearedByCentre(x, y, width(), height(), props.clearRows ?? 24, props.clearCols ?? 72)

  onMount(() => {
    let current = drops()
    const id = setInterval(() => {
      const w = width()
      const h = height()
      current = current.map((drop) => {
        const y = drop.y + drop.speed
        if (y - TRAIL >= h) return makeDrop(w, h, false)
        // flicker a few glyphs as it falls
        const glyphs =
          Math.random() < 0.5
            ? drop.glyphs.map((g) => (Math.random() < 0.15 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : g))
            : drop.glyphs
        return { ...drop, y, glyphs }
      })
      setDrops(current)
    }, TICK_MS)
    onCleanup(() => clearInterval(id))
  })

  return (
    <box position="absolute" top={0} left={0} width="100%" height="100%">
      <For each={ids}>{(i) => <DropColumn drop={drops()[i]} offsets={trailOffsets} hidden={inCentre} palette={palette} />}</For>
    </box>
  )
}

function DropColumn(props: {
  drop: Drop | undefined
  offsets: number[]
  hidden: (x: number, y: number) => boolean
  palette: string[]
}) {
  return (
    <For each={props.offsets}>
      {(distance) => {
        const top = () => Math.round(props.drop?.y ?? -10_000) - distance
        const left = () => {
          const col = props.drop?.col ?? -1
          return props.hidden(col, top()) ? -1 : col
        }
        return (
          <text position="absolute" left={left()} top={top()} fg={fadeColour(props.palette, distance)}>
            {props.drop?.glyphs[distance] ?? " "}
          </text>
        )
      }}
    </For>
  )
}
