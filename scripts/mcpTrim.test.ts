import { stripSchemaDescriptions, trimDescription } from "../src/mcpTrim"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

check("keeps the first sentence", trimDescription("Do a thing. Then do another.") === "Do a thing.")
check("uses the first non-empty line", trimDescription("\n\nFirst line\nsecond line") === "First line")
check("caps a very long description", (trimDescription("x".repeat(500)) ?? "").length <= 140)
check("empty descriptions stay empty", trimDescription("") === undefined && trimDescription(undefined) === undefined)

const schema = {
  type: "object",
  description: "root description",
  properties: {
    path: { type: "string", description: "the path" },
    mode: { enum: ["a", "b"], description: "the mode" },
  },
  required: ["path"],
}
const stripped = stripSchemaDescriptions(schema)
check("drops description fields", !JSON.stringify(stripped).includes("description"))
check(
  "keeps the schema structure",
  stripped.type === "object" &&
    stripped.properties.path.type === "string" &&
    stripped.properties.mode.enum.length === 2 &&
    stripped.required[0] === "path",
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
