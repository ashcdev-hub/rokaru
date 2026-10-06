import { writeFileSync } from "node:fs"
import { runTurn, resetHistory } from "../src/agent"
import { loadConfig, resolveApiKey } from "../src/config"
import { clearProxyEnv } from "../src/guard"
import { listModels } from "../src/omlx"
import * as store from "../src/store"

clearProxyEnv()
const config = loadConfig()
const baseURL = config.baseURL
const apiKey = resolveApiKey()

// 64x64 PNG: red with a blue square in the top-left (embedded).
const b64 =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAb0lEQVR42u3QMREAMAzEsEcS/qDKJQXQsVMuGgzAStL906kaXQAAAAAAAAAAAAAAAAAAAICFANMHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABPF/fgWPAJ1lK/AAAAAElFTkSuQmCC"
const png = Buffer.from(b64, "base64")
const imagePath = "/tmp/rokaru-vision-test.png"
writeFileSync(imagePath, png)

const models = await listModels({ baseURL, apiKey })
const model = process.argv[2] ?? models.find((m) => m.id.includes("Ornith"))?.id ?? models[0].id
store.setModel(model)
store.setModelLimit(models.find((m) => m.id === model)?.maxModelLen ?? 0)

await runTurn(
  {
    baseURL,
    apiKey,
    model,
    modelLimit: store.modelLimit(),
    config,
    workspace: process.cwd(),
    signal: new AbortController().signal,
    attachments: [{ name: "vision-test.png", dataUrl: `data:image/png;base64,${b64}` }],
  },
  "What colours and shapes do you see? Be very brief.",
)

const text = store
  .messages()
  .flatMap((m) => m.parts)
  .filter((p) => p.kind === "text")
  .map((p) => (p as { text: string }).text)
  .join(" ")
  .toLowerCase()

console.log("assistant said:", text.trim().slice(0, 200))
const ok = text.includes("red") && text.includes("blue")
console.log(ok ? "PASS  vision: described red + blue" : "FAIL  vision: unexpected answer")

// Now test the view_image tool (model loads the image itself).
store.resetSession()
resetHistory()
await runTurn(
  {
    baseURL,
    apiKey,
    model,
    modelLimit: store.modelLimit(),
    config,
    workspace: process.cwd(),
    signal: new AbortController().signal,
  },
  `Use the view_image tool to open ${imagePath} and then tell me the colours you see. Be very brief.`,
)

const text2 = store
  .messages()
  .flatMap((m) => m.parts)
  .filter((p) => p.kind === "text")
  .map((p) => (p as { text: string }).text)
  .join(" ")
  .toLowerCase()
console.log("view_image said:", text2.trim().slice(0, 200))
const ok2 = text2.includes("red") && text2.includes("blue")
console.log(ok2 ? "PASS  view_image: described red + blue" : "FAIL  view_image: unexpected answer")

resetHistory()
process.exit(ok && ok2 ? 0 : 1)
