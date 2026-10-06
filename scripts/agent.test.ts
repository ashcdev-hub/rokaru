import { createEffect, createRoot } from "solid-js"
import { runTurn, resetHistory } from "../src/agent"
import { loadConfig, resolveApiKey } from "../src/config"
import { clearProxyEnv } from "../src/guard"
import { listModels } from "../src/omlx"
import * as store from "../src/store"

clearProxyEnv()
const config = loadConfig()
const baseURL = config.baseURL
const apiKey = resolveApiKey()

const models = await listModels({ baseURL, apiKey })
const model = process.argv[2] ?? models.find((m) => m.id.includes("Ornith"))?.id ?? models[0].id
store.setModel(model)
store.setModelLimit(models.find((m) => m.id === model)?.maxModelLen ?? 0)
store.setWorkspace(process.cwd())

createRoot(() =>
  createEffect(() => {
    const pending = store.permission()
    if (pending) {
      console.error(`[permission requested] ${pending.name} -> approving`)
      store.answerPermission(true)
    }
  }),
)

const prompt = process.argv[3] ?? "List the files in the current directory using a tool, then tell me how many there are."
console.error(`[turn] model=${model}\n[turn] prompt=${prompt}`)

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
  prompt,
)

console.log("\n===== TRANSCRIPT =====")
for (const message of store.messages()) {
  console.log(`\n[${message.role}]`)
  for (const part of message.parts) {
    if (part.kind === "text") console.log(part.text)
    else if (part.kind === "reasoning") console.log(`(reasoning) ${part.text}`)
    else console.log(`(tool ${part.name} ${part.status})\n${part.result.slice(0, 800)}`)
  }
}

console.log("\n===== METRICS =====")
console.log(JSON.stringify(store.metrics(), null, 2))
console.log("contextPercent:", store.contextPercent().toFixed(1))
console.log("status:", store.status(), "error:", store.error())

resetHistory()
process.exit(0)
