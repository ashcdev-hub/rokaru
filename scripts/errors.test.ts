import { friendlyError } from "../src/errors"

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

const big = friendlyError(new Error("prefill memory guard: not enough memory"), ctx)
check("context overflow points at /compact", /compact/i.test(big), big)

const abort = friendlyError(Object.assign(new Error("x"), { name: "AbortError" }), ctx)
check("abort is reported plainly", abort === "aborted", abort)

const other = friendlyError(new Error("something odd happened"), ctx)
check("unknown errors pass through unchanged", other === "something odd happened", other)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
