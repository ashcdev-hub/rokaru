import { friendlyError } from "../src/errors"
import { isContextOverflow } from "../src/agent"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const ctx = { baseURL: "http://127.0.0.1:8000/v1", model: "Ling-3.0-tiny-oQ6e" }

const refused = friendlyError(new TypeError("Unable to connect. Is the computer able to access the url?"), ctx)
check("connection refused is explained", /oMLX server running/i.test(refused), refused)
check("connection message includes the address", refused.includes("127.0.0.1:8000"), refused)

const notFound = friendlyError(new Error("oMLX HTTP 404: model 'Ling-3.0-tiny-oQ6e' not found"), ctx)
check("missing model is explained", /does not have 'Ling-3.0-tiny-oQ6e' loaded/i.test(notFound), notFound)

const auth = friendlyError(new Error("oMLX HTTP 401: unauthorized"), ctx)
check("auth failure mentions the API key", /api key/i.test(auth), auth)

const timeout = friendlyError(new Error("request timed out"), ctx)
check("timeout is explained", /time/i.test(timeout), timeout)

const memory = friendlyError(
  new Error(
    "oMLX HTTP 400: oMLX prefill memory guard rejected this prompt: Prefill would require ~33.52 GB peak (current 29.42 GB + KV+SDPA 4.11 GB) but dynamic ceiling is 31.00 GB.",
  ),
  ctx,
)
check("memory guard is explained as a RAM limit", /memory/i.test(memory) && /not the model's/i.test(memory), memory)
check("memory guard does not suggest /compact", !/compact/i.test(memory), memory)

const context = friendlyError(new Error("context length exceeded: too many tokens"), ctx)
check("context overflow points at /compact", /compact/i.test(context), context)

check(
  "isContextOverflow ignores memory-guard errors",
  isContextOverflow(new Error("oMLX prefill memory guard rejected this prompt")) === false,
)
check("isContextOverflow catches real context errors", isContextOverflow(new Error("context length exceeded")) === true)

const abort = friendlyError(Object.assign(new Error("x"), { name: "AbortError" }), ctx)
check("abort is reported plainly", abort === "aborted", abort)

const other = friendlyError(new Error("something odd happened"), ctx)
check("unknown errors pass through unchanged", other === "something odd happened", other)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
