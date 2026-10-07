/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { Markdown } from "../src/components/Markdown"

const md = [
  "# Heading one",
  "",
  "A line with *italic* and **bold** and `code`.",
  "",
  "```ts",
  "const x: number = 42 // answer",
  "```",
  "",
  "> a quoted line",
  "",
  "- first item",
  "- second item",
  "",
  "| Model | Score |",
  "| --- | --- |",
  "| GPT | 9 |",
  "| Qwen | 8 |",
].join("\n")

const setup = await testRender(() => <Markdown text={md} />, { width: 60, height: 34 })
await setup.flush()
const frame = setup.captureCharFrame()
console.log(frame)
const lines = frame.split("\n")

const headingAt = lines.findIndex((l) => l.includes("Heading one"))
const checks: [string, boolean][] = [
  ["heading", headingAt >= 0],
  ["blank line after heading", headingAt >= 0 && lines[headingAt + 1]?.trim() === ""],
  ["italic stripped", frame.includes("italic") && !frame.includes("*italic*")],
  ["bold stripped", !frame.includes("**bold**")],
  ["code fence", frame.includes("const x: number = 42")],
  ["code line numbers", frame.includes("1 const x: number = 42")],
  ["blockquote bar", frame.includes("│ a quoted line")],
  ["list bullet", frame.includes("• first item") && frame.includes("• second item")],
  ["table header", frame.includes("Model") && frame.includes("Score")],
  ["table separator", frame.includes("┼")],
  ["table row", frame.includes("GPT") && frame.includes("Qwen")],
]
const ok = checks.every(([, v]) => v)
for (const [name, v] of checks) console.log(`${v ? "PASS" : "FAIL"}  ${name}`)
setup.renderer.destroy()
process.exit(ok ? 0 : 1)
