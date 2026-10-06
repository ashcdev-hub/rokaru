import { clearProxyEnv } from "../src/guard"
import { listModels, streamChat } from "../src/omlx"

clearProxyEnv()
const baseURL = "http://127.0.0.1:8000/v1"
const apiKey = "sk-omlx-local"

const models = await listModels({ baseURL, apiKey })
console.log("models:", models.map((m) => `${m.id} (${m.maxModelLen})`).join(", "))

const model = process.argv[2] ?? models[0]?.id
console.log("streaming with:", model)

const ac = new AbortController()
const started = performance.now()
let firstContent = 0
let content = ""
for await (const ev of streamChat(
  { baseURL, apiKey },
  {
    model,
    messages: [{ role: "user", content: "Reply with exactly: hello from rokaru" }],
    temperature: 0.7,
    topP: 0.95,
    topK: 20,
    maxTokens: 200,
  },
  ac.signal,
)) {
  if (ev.type === "content") {
    if (!firstContent) firstContent = performance.now()
    content += ev.text
  }
  if (ev.type === "reasoning") process.stderr.write(".")
  if (ev.type === "finish") console.log("\nfinish:", ev.reason)
  if (ev.type === "usage") console.log("usage:", JSON.stringify(ev.usage))
}
console.log("content:", JSON.stringify(content.trim()))
console.log("wall ms:", Math.round(performance.now() - started))
