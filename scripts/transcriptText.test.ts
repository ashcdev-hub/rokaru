import { formatTranscript } from "../src/transcriptText"
import type { UIMessage } from "../src/store"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const messages: UIMessage[] = [
  { id: "u1", role: "user", parts: [{ kind: "text", text: "do a thing" }] },
  {
    id: "a1",
    role: "assistant",
    parts: [
      { kind: "reasoning", text: "thinking about it" },
      { kind: "text", text: "done" },
      { kind: "tool", id: "t1", name: "bash", args: '{"command":"ls"}', status: "ok", result: "a.ts\nb.ts" },
    ],
  },
  { id: "i1", role: "info", parts: [{ kind: "text", text: "note" }] },
]

const text = formatTranscript(messages, { workspace: "/w", model: "M" })

check("has a title", text.startsWith("# rokaru transcript"))
check("includes model", text.includes("model: M"))
check("includes workspace", text.includes("workspace: /w"))
check("includes user header + text", text.includes("## you") && text.includes("do a thing"))
check("includes agent header + text", text.includes("## agent") && text.includes("done"))
check("includes reasoning", text.includes("[thinking]") && text.includes("thinking about it"))
check("includes tool name and args", text.includes('[tool bash] {"command":"ls"}'))
check("indents tool result", text.includes("  a.ts") && text.includes("  b.ts"))
check("includes info note", text.includes("## note") && text.includes("note"))
check("ends with a newline", text.endsWith("\n"))
check("empty session still has a header", formatTranscript([]).trim() === "# rokaru transcript")

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
