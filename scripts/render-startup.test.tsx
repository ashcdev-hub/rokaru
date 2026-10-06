/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { Startup } from "../src/App"

const models = [
  { id: "Ornith-1.5-35B-A3B-oQ6e-fixed-mtp", maxModelLen: 131072 },
  { id: "Qwen3.8-27B-Huihui-Abliterated-oQ4e-MTP-MLX", maxModelLen: 131072 },
]

async function frame(width: number, height: number) {
  const setup = await testRender(
    () => <Startup phase="pick" message="" models={models} onSelect={() => {}} />,
    { width, height },
  )
  await setup.flush()
  console.log(`----- STARTUP (${width}x${height}) -----`)
  console.log(setup.captureCharFrame())
  const spans = setup.captureSpans()
  // Show the distinct colours the logo was given this load.
  const colours = new Set<string>()
  for (const line of spans.lines ?? []) {
    for (const span of line.spans ?? []) {
      if (span.fg) colours.add(typeof span.fg === "string" ? span.fg : JSON.stringify(span.fg))
    }
  }
  console.log("distinct colours:", [...colours].slice(0, 6).join(" "))
  setup.renderer.destroy()
}

await frame(140, 40)
process.exit(0)
