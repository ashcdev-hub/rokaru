import { health, listModelStatus, loadModel, serverOrigin, streamChat, type StreamEvent } from "../src/omlx"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const realFetch = globalThis.fetch
const opts = { baseURL: "http://127.0.0.1:8000/v1", apiKey: "k" }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

function sseResponse(lines: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      for (const line of lines) controller.enqueue(enc.encode(line))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } })
}

// serverOrigin
check("origin strips /v1", serverOrigin("http://127.0.0.1:8000/v1") === "http://127.0.0.1:8000")
check("origin strips trailing slash", serverOrigin("http://127.0.0.1:8000/v1/") === "http://127.0.0.1:8000")
check("origin keeps a bare host", serverOrigin("http://127.0.0.1:8000") === "http://127.0.0.1:8000")

// health
{
  globalThis.fetch = (async () => jsonResponse({ status: "loading" }, 503)) as typeof fetch
  const h = await health(opts)
  check("health 503 is loading", h.loading === true && h.status === 503 && h.detail === "loading")
}
{
  globalThis.fetch = (async () => jsonResponse({ status: "ok" }, 200)) as typeof fetch
  const h = await health(opts)
  check("health 200 is healthy", h.ok === true && h.loading === false)
}
{
  globalThis.fetch = (async () => {
    throw new Error("boom")
  }) as typeof fetch
  const h = await health(opts)
  check("health handles errors", h.ok === false && h.status === 0)
}

// listModelStatus
{
  globalThis.fetch = (async () =>
    jsonResponse({
      models: [
        { id: "a", loaded: true, is_loading: false, pinned: true, actual_size: 123, model_type: "llm", thinking_default: true },
      ],
    })) as typeof fetch
  const s = await listModelStatus(opts)
  check("status maps fields", s[0]?.id === "a" && s[0].loaded && s[0].pinned && s[0].thinkingDefault === true)
}
{
  globalThis.fetch = (async () => jsonResponse({ data: [{ id: "b", model_type: "embedding" }] })) as typeof fetch
  const s = await listModelStatus(opts)
  check("status accepts {data} shape", s.length === 1 && s[0].modelType === "embedding")
}
{
  globalThis.fetch = (async () => jsonResponse([{ id: "c" }])) as typeof fetch
  const s = await listModelStatus(opts)
  check("status accepts a bare array", s.length === 1 && s[0].id === "c")
}
{
  globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch
  check("status returns [] on error", (await listModelStatus(opts)).length === 0)
}

// loadModel
{
  globalThis.fetch = (async () => jsonResponse({ status: "ok" })) as typeof fetch
  check("loadModel true on 200", (await loadModel(opts, "m")) === true)
}
{
  globalThis.fetch = (async () => new Response("bad", { status: 500 })) as typeof fetch
  check("loadModel false on error", (await loadModel(opts, "m")) === false)
}

// streamChat: progress + content + usage, and the request body flag
{
  let sentBody: any
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sentBody = JSON.parse(String(init?.body))
    return sseResponse([
      'data: {"choices":[],"prompt_progress":{"total":100,"cache":20,"processed":40,"time_ms":500}}\n',
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":2}}\n',
      "data: [DONE]\n",
    ])
  }) as typeof fetch

  const events: StreamEvent[] = []
  for await (const ev of streamChat(opts, { model: "m", messages: [], returnProgress: true }, new AbortController().signal)) {
    events.push(ev)
  }
  const progress = events.find((e) => e.type === "progress") as Extract<StreamEvent, { type: "progress" }> | undefined
  check("return_progress is sent", sentBody?.return_progress === true)
  check("progress event parsed", !!progress && progress.total === 100 && progress.processed === 40 && progress.cache === 20 && progress.timeMs === 500)
  check("content still parsed", events.some((e) => e.type === "content" && e.text === "hi"))
  check("usage still parsed", events.some((e) => e.type === "usage"))
  check("finish still parsed", events.some((e) => e.type === "finish" && e.reason === "stop"))
}

globalThis.fetch = realFetch

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
