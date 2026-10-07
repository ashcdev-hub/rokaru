import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { applyMention, extractMention, mentionMatches, resetMentionCache, workspaceFiles } from "../src/fileMentions"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

const dir = mkdtempSync(join(tmpdir(), "rokaru-mentions-"))
const put = (rel: string, content = "x") => {
  const full = join(dir, rel)
  mkdirSync(join(full, ".."), { recursive: true })
  writeFileSync(full, content)
}

put("src/index.ts")
put("src/tool.ts")
put("README.md")
put("node_modules/dep/index.js")
put(".git/config")

resetMentionCache()
const files = workspaceFiles(dir)
check("lists workspace files", files.includes("src/index.ts") && files.includes("README.md"))
check("skips node_modules", !files.some((f) => f.includes("node_modules")))
check("skips .git", !files.some((f) => f.startsWith(".git")))

check("extracts a mention at the start", JSON.stringify(extractMention("@src")) === JSON.stringify({ query: "src", start: 0 }))
check("extracts a mention mid-text", extractMention("look at @REA")?.query === "REA")
check("no mention without @", extractMention("hello world") === undefined)

const match = mentionMatches("@ind", dir)
check("matches by substring", Boolean(match) && match!.files.includes("src/index.ts"))
check("is case-insensitive", Boolean(mentionMatches("@readme", dir)))
check("ignores command input", mentionMatches("/model @x", dir) === undefined)
check("a trailing space closes the mention", mentionMatches("@README.md ", dir) === undefined)

const resolved = mentionMatches("@ind", dir)!
check("applyMention inserts the path", applyMention("@ind", resolved, "src/index.ts") === "@src/index.ts ")

rmSync(dir, { recursive: true, force: true })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
