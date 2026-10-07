/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { Startup } from "../src/App"
import { logoPalette } from "../src/ascii"

const models = [
  { id: "Ornith-1.5-35B-A3B-oQ6e-fixed-mtp", maxModelLen: 131072 },
  { id: "Qwen3.8-27B-Huihui-Abliterated-oQ4e-MTP-MLX", maxModelLen: 131072 },
]

const setup = await testRender(
  () => <Startup phase="pick" message="" models={models} onSelect={() => {}} />,
  { width: 140, height: 40 },
)
await setup.flush()
const before = setup.captureCharFrame()
console.log(before)

// Let the background animate, then capture again.
await new Promise((r) => setTimeout(r, 400))
await setup.flush()
const after = setup.captureCharFrame()

const glyphs = (before.match(/[0-9<>|/\\+=*:\-·•]/g) ?? []).length

// The rain should be tinted with colours sampled from the logo's gradient.
const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
const palette = logoPalette().map(hexToRgb)
const spanColours = new Set<string>()
for (const line of setup.captureSpans().lines ?? []) {
  for (const span of line.spans ?? []) {
    const b = (span as any).fg?.buffer
    if (b) spanColours.add(`${b[0]},${b[1]},${b[2]}`)
  }
}
const usesPalette = palette.length > 0 && palette.some((c) => spanColours.has(c))

const checks: [string, boolean][] = [
  ["logo/picker present", before.includes("choose a model")],
  ["logo strokes intact", before.includes("██████╗") && before.includes("╚═════╝")],
  ["picker text intact", before.includes("Ornith-1.5-35B-A3B-oQ6e-fixed-mtp")],
  ["background rain rendered", glyphs > 5],
  ["rain uses logo palette", usesPalette],
  ["background animates", before !== after],
]
const ok = checks.every(([, v]) => v)
for (const [name, v] of checks) console.log(`${v ? "PASS" : "FAIL"}  ${name} (glyphs=${glyphs})`)
setup.renderer.destroy()
process.exit(ok ? 0 : 1)
