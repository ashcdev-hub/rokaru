import { needsPermission, permissionKey } from "../src/permissions"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

check("bash key is the leading command word", permissionKey("bash", { command: "git status" }) === "git")
check("mcp_call key names the target tool", permissionKey("mcp_call", { tool: "mcp__x__read" }) === "mcp_call:mcp__x__read")
check("other tools key by name", permissionKey("write_file", {}) === "write_file")

const deny = { isToolAllowed: () => false, isCommandAllowed: () => false }
const destructive = (over: any) => ({ name: "write_file", destructive: true, args: {}, autoApprove: false, ...deny, ...over })

check(
  "read-only tools never prompt",
  needsPermission({ name: "read_file", destructive: false, args: {}, autoApprove: false, ...deny }) === false,
)
check("destructive tools prompt", needsPermission(destructive({})) === true)
check("autoApprove skips the prompt", needsPermission(destructive({ autoApprove: true })) === false)
check(
  "a remembered tool skips the prompt",
  needsPermission(destructive({ isToolAllowed: (k: string) => k === "write_file" })) === false,
)
check(
  "a remembered bash command skips the prompt",
  needsPermission({
    name: "bash",
    destructive: true,
    args: { command: "git diff" },
    autoApprove: false,
    isToolAllowed: () => false,
    isCommandAllowed: (w: string) => w === "git",
  }) === false,
)
check(
  "an unknown bash command still prompts",
  needsPermission({
    name: "bash",
    destructive: true,
    args: { command: "rm -rf /tmp/x" },
    autoApprove: false,
    isToolAllowed: () => false,
    isCommandAllowed: (w: string) => w === "git",
  }) === true,
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
