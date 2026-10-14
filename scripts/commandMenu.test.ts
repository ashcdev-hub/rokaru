import { frequentCommandNames, matchCommands, orderedMenuCommands } from "../src/commands"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  ok ? pass++ : fail++
}

check("no usage → frequent is empty", frequentCommandNames({}).length === 0)
check(
  "frequent is needs-first",
  JSON.stringify(frequentCommandNames({ themes: 2, model: 1 })) === JSON.stringify(["themes", "model"]),
)
check("frequent ignores unknown names", frequentCommandNames({ nope: 9 }).length === 0)
check("frequent ignores zero counts", frequentCommandNames({ themes: 0 }).length === 0)
check("frequent respects the limit", frequentCommandNames({ themes: 1, model: 1, undo: 1, redo: 1 }, 2).length === 2)
check(
  "frequent ties break alphabetically",
  JSON.stringify(frequentCommandNames({ undo: 1, redo: 1 })) === JSON.stringify(["redo", "undo"]),
)

const all = matchCommands("")
check("empty usage keeps the default order", JSON.stringify(orderedMenuCommands("", {})) === JSON.stringify(all))
check("used command floats to the top", orderedMenuCommands("", { themes: 5 })[0].name === "themes")
check("ordering keeps every command", orderedMenuCommands("", { themes: 5 }).length === all.length)
check("no duplicates after reordering", new Set(orderedMenuCommands("", { themes: 5, model: 2 }).map((c) => c.name)).size === all.length)

const th = matchCommands("th")
check("a prefix query is unchanged", JSON.stringify(orderedMenuCommands("th", { themes: 5 })) === JSON.stringify(th))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
