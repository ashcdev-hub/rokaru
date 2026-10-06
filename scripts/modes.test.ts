import { toolSchemas } from "../src/tools"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}
const names = (web: boolean, plan: boolean) => toolSchemas(web, plan).map((t) => t.function.name)

const build = names(true, false)
check("build: has write_file", build.includes("write_file"))
check("build: has edit_file", build.includes("edit_file"))
check("build: has bash", build.includes("bash"))
check("build: has todo_write", build.includes("todo_write"))

const plan = names(true, true)
check("plan: no write_file", !plan.includes("write_file"))
check("plan: no edit_file", !plan.includes("edit_file"))
check("plan: no bash", !plan.includes("bash"))
check("plan: keeps read_file", plan.includes("read_file"))
check("plan: keeps grep", plan.includes("grep"))
check("plan: keeps todo_write", plan.includes("todo_write"))

const noWeb = names(false, false)
check("web off: no web_search", !noWeb.includes("web_search"))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
