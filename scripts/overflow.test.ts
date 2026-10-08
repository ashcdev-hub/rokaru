import { isContextOverflow } from "../src/agent"

let pass = 0
let fail = 0
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
  ok ? pass++ : fail++
}

check(
  "memory guard is not a context overflow",
  !isContextOverflow(
    new Error(
      'oMLX HTTP 400: {"error":{"message":"oMLX prefill memory guard rejected this prompt: Prefill would require ~33.11 GB peak (current 29.62 GB + KV+SDPA 3.49 GB) but dynamic ceiling is 32.72 GB."}}',
    ),
  ),
)
check("maximum context length", isContextOverflow(new Error("This model's maximum context length is 131072 tokens")))
check("exceeds context", isContextOverflow(new Error("prompt exceeds the context window")))
check("too many tokens", isContextOverflow(new Error("input is too many tokens")))
check("non-overflow error ignored", !isContextOverflow(new Error("ECONNREFUSED 127.0.0.1:8000")))
check("generic error ignored", !isContextOverflow(new Error("unknown tool 'foo'")))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
