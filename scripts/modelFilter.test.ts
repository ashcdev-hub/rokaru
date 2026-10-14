import { filterModels } from "../src/modelFilter"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const models = [
  { id: "Qwen3.8-27B-oQ4e-MTP-MLX", maxModelLen: 131072 },
  { id: "Ornith-1.5-35B-oQ6e", maxModelLen: 131072 },
  { id: "Ling-3.0-tiny-oQ6e", maxModelLen: 32768 },
]

check("empty query returns all", filterModels(models, "").length === 3)
check("whitespace query returns all", filterModels(models, "   ").length === 3)
check("case-insensitive substring", filterModels(models, "qwen").map((m) => m.id).every((id) => id.toLowerCase().includes("qwen")))
check("matches exactly one", filterModels(models, "ornith").length === 1)
check("matches multiple", filterModels(models, "oq6e").length === 2)
check("no match returns empty", filterModels(models, "zzz").length === 0)
check("does not mutate input", (filterModels(models, "qwen"), models.length === 3))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
