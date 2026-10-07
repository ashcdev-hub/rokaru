import { estimateTokens, truncateToTokens } from "../src/tokens"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

check("estimates roughly 4 chars per token", estimateTokens("abcd") === 1 && estimateTokens("abcdefgh") === 2)
check("empty text is zero tokens", estimateTokens("") === 0)

const short = "short"
check("short text is untouched", truncateToTokens(short, 100) === short)

const long = "x".repeat(100)
const cut = truncateToTokens(long, 5)
check("long text is truncated to the token budget", cut.startsWith("x".repeat(20)) && cut.includes("truncated"))
check("zero budget means no cap", truncateToTokens(long, 0) === long)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
