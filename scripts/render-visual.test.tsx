/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { ChatView } from "../src/components/ChatView"
import * as store from "../src/store"

store.setWorkspace("/Users/ash/dev/rokaru")
store.setGitBranch("main*")
store.setModel("Ornith-1.5-35B-A3B-oQ6e-fixed-mtp")
store.setModelLimit(131072)
store.setPromptTokens(21400)
store.setContextPercent(16.3)
store.setMetrics({
  ttft: 1.5,
  tps: 27.4,
  outputTokens: 234,
  promptTokens: 21400,
  cachedTokens: 18000,
  contextLimit: 131072,
  elapsed: 4.2,
  model: "Ornith-1.5-35B-A3B-oQ6e-fixed-mtp",
})

store.addUserMessage("update the readme tools section")
const id = store.startAssistantMessage()
store.appendText(id, "reasoning", "The user wants the README updated.")
store.setMessageThinking(id, 1.7)
store.appendText(id, "text", "Updated the **tools** section.\n")
store.addToolPart(id, "call_1", "edit_file", '{"path":"~/dev/rokaru/README.md"}')
store.updateToolPart(id, "call_1", {
  status: "ok",
  result: "replaced 1 occurrence(s)",
  durationMs: 1234,
  diff: [
    { kind: "ctx", text: "62  read_file, list_dir, glob" },
    { kind: "del", text: "63  bash ask for permission." },
    { kind: "add", text: "63  bash ask first. Choose allow or deny." },
  ],
})
store.setStatus("idle")

const setup = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={4} />, { width: 100, height: 32 })
await setup.flush()
await new Promise((r) => setTimeout(r, 250))
await setup.flush()
const frame = setup.captureCharFrame()
console.log(frame)

const checks: [string, boolean][] = [
  ["user label", frame.includes("you")],
  ["agent label", frame.includes("agent")],
  ["tool icon+duration", frame.includes("✎") && frame.includes("1.2s")],
  ["cache %", frame.includes("cache 84%")],
  ["elapsed FIELD", frame.includes("TIME") && frame.includes("4.2s")],
  ["git branch", frame.includes("⎇ main*")],
  ["footer status", frame.includes("ctrl+p") && frame.includes("build")],
]
const ok = checks.every(([, v]) => v)
for (const [name, v] of checks) console.log(`${v ? "PASS" : "FAIL"}  ${name}`)
setup.renderer.destroy()

// Permission preview: bash command shown as a code block.
store.requestPermission("bash", '{"command":"rm -rf ./tmp && echo hi"}', true)
const perm = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={4} />, { width: 100, height: 30 })
await perm.flush()
const permFrame = perm.captureCharFrame()
const permOk = permFrame.includes("$ rm -rf ./tmp && echo hi") && permFrame.includes("always allow “rm …”")
console.log(permOk ? "PASS  permission preview (bash code block + pattern)" : "FAIL  permission preview")
perm.renderer.destroy()

process.exit(ok && permOk ? 0 : 1)
