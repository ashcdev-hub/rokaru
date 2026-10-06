import { decorateAssistant } from "../src/highlight"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const out = decorateAssistant("It took 2.5s, cost $10, hit 50% and finished at 2pm on 16 Oct 2025.")
check("highlights time 2.5s", out.includes("**2.5s**"))
check("highlights currency $10", out.includes("**$10**"))
check("highlights percent 50%", out.includes("**50%**"))
check("highlights time 2pm", out.includes("**2pm**"))
check("highlights date 16 Oct", out.includes("**16 Oct**"))

check("leaves plain words alone", decorateAssistant("hello world") === "hello world")

const fence = "```\nvalue = 2.5s\n```"
check("does not touch fenced code", decorateAssistant(fence) === fence)

const inline = "use `2.5s` here"
check("does not touch inline code", decorateAssistant(inline) === inline)

const link = "[docs](https://example.com/v2/download)"
check("does not touch link targets", decorateAssistant(link) === link)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
