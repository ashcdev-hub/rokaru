/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { ChatView } from "../src/components/ChatView"
import { CommandPalette, filterPaletteActions, type PaletteAction } from "../src/components/CommandPalette"
import { Sidebar } from "../src/components/Sidebar"
import * as store from "../src/store"
import type { InputHandle } from "../src/components/InputBox"
import { shouldCollapsePaste } from "../src/components/InputBox"

store.setModel("Ornith-1.5-35B-A3B-oQ6e-fixed-mtp")
store.setModelLimit(131072)
store.setWorkspace("/Users/ash/dev/rokaru")

let handle: InputHandle | undefined
const chat = await testRender(
  () => <ChatView onSubmit={() => {}} inputHeight={10} onReady={(h) => (handle = h)} />,
  { width: 100, height: 30 },
)
await chat.flush()

const panelHeight = (frame: string): number => {
  const rows = frame.split("\n")
  const bottoms = rows.map((r, i) => (r.includes("╰") ? i : -1)).filter((i) => i >= 0)
  const tops = rows.map((r, i) => (r.includes("╭") ? i : -1)).filter((i) => i >= 0)
  if (bottoms.length === 0 || tops.length < 2) return -1
  return bottoms[0]! - tops[1]! + 1
}

const emptyFrame = chat.captureCharFrame()
const emptyHeight = panelHeight(emptyFrame)

handle?.setText("a".repeat(200))
await chat.flush()
const grownFrame = chat.captureCharFrame()
const grownHeight = panelHeight(grownFrame)

handle?.setText("one\ntwo\nthree\nfour\nfive\nsix")
await chat.flush()
const sixLineHeight = panelHeight(chat.captureCharFrame())

handle?.setText(Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join("\n"))
await chat.flush()
const tenLineHeight = panelHeight(chat.captureCharFrame())
handle?.clear()

handle?.setText(Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n"))
await chat.flush()
const overCapTextareaEmpty = (handle?.getText() ?? "") === ""
const overCapStashLines = store.pastedText().split("\n").length
const overCapNotice = chat.captureCharFrame().includes("Pasted 12 lines")
store.clearPastedText()
handle?.clear()

const pasteProbe: any = chat as any
await pasteProbe.mockInput.pasteBracketedText("hello")
await chat.flush()
const smallPasteKept = (handle?.getText() ?? "").includes("hello") && store.pastedText() === ""
handle?.clear()

const bigPaste = Array.from({ length: 30 }, (_, i) => `pasted line ${i + 1}`).join("\n")
await pasteProbe.mockInput.pasteBracketedText(bigPaste)
await chat.flush()
await new Promise((r) => setTimeout(r, 100))
await chat.flush()
const collapsedTextareaEmpty = (handle?.getText() ?? "") === ""
const collapsedStashLines = store.pastedText().split("\n").length
const collapsedFrame = chat.captureCharFrame()
const collapsedHeight = panelHeight(collapsedFrame)
store.clearPastedText()
handle?.clear()

const idleClean = !emptyFrame.includes("message · /") && emptyFrame.includes("Build")

store.setStatus("streaming")
const busyChat = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={5} />, { width: 100, height: 30 })
await busyChat.flush()
const busyHasStatus = busyChat.captureCharFrame().includes("working…")
busyChat.renderer.destroy()
store.setStatus("idle")

store.requestPermission("bash", '{"command":"rm -rf ./tmp && echo hi"}', true)
const permChat = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={5} />, { width: 100, height: 34 })
await permChat.flush()
const permFrame = permChat.captureCharFrame()
permChat.renderer.destroy()
store.answerPermission("deny")

const pendingAnswer = store.requestQuestion("call_q", "Pick a colour", [
  { label: "Red" },
  { label: "Blue", description: "cool" },
])
const qChat = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={5} />, { width: 100, height: 30 })
await qChat.flush()
const qFrame = qChat.captureCharFrame()
store.answerQuestion({ kind: "option", index: 1, label: "Blue" })
const resolvedAnswer = await pendingAnswer
qChat.renderer.destroy()

const typePending = store.requestQuestion("call_custom", "Pick one?", [{ label: "X" }, { label: "Y" }])
store.selectQuestionRow(2)
const typingEntered = store.questionTyping() && !!store.question()
const typeChat = await testRender(
  () => <ChatView onSubmit={() => {}} inputHeight={5} onContentChange={(v) => store.setInputValue(v)} />,
  { width: 100, height: 30 },
)
await typeChat.flush()
const typeFrame = typeChat.captureCharFrame()
await (typeChat as any).mockInput.typeText("my answer")
await typeChat.flush()
const typedLanded = store.inputValue() === "my answer"
store.answerQuestion({ kind: "custom", text: store.inputValue() })
const resolvedCustom = await typePending
typeChat.renderer.destroy()

store.setInputPrefill("/image ")
const preChat = await testRender(() => <ChatView onSubmit={() => {}} inputHeight={5} />, { width: 100, height: 30 })
await preChat.flush()
const preFrame = preChat.captureCharFrame()
const prefillShown = preFrame.includes("/image ")
const prefillConsumed = store.inputPrefill() === ""
preChat.renderer.destroy()

const paletteActions: PaletteAction[] = [
  { label: "/model", description: "switch model" },
  { label: "/plan", description: "read-only planning mode" },
  { label: "quit", description: "exit rokaru" },
]
const filteredLabels = filterPaletteActions(paletteActions, "mod").map((a) => a.label)
const palChat = await testRender(
  () => (
    <CommandPalette
      actions={filterPaletteActions(paletteActions, "mod")}
      query="mod"
      onPick={() => {}}
    />
  ),
  { width: 80, height: 20 },
)
await palChat.flush()
const palFrame = palChat.captureCharFrame()
palChat.renderer.destroy()

const emptyPalChat = await testRender(
  () => <CommandPalette actions={filterPaletteActions(paletteActions, "zzz")} query="zzz" onPick={() => {}} />,
  { width: 80, height: 20 },
)
await emptyPalChat.flush()
const emptyPalFrame = emptyPalChat.captureCharFrame()
emptyPalChat.renderer.destroy()

const sideChat = await testRender(() => <Sidebar width={34} />, { width: 40, height: 30 })
await sideChat.flush()
const sideFrame = sideChat.captureCharFrame()
sideChat.renderer.destroy()

chat.renderer.destroy()

const checks: [string, boolean][] = [
  ["input is compact when empty", emptyHeight === 6],
  ["input grows with long text", grownHeight === 7],
  ["input grows to six rows", sixLineHeight === 9],
  ["input caps at ten rows", tenLineHeight === 13],
  ["small pastes stay inline", smallPasteKept],
  ["collapse policy", !shouldCollapsePaste("hi") && !shouldCollapsePaste("") && shouldCollapsePaste("a\nb\nc\nd") && shouldCollapsePaste("x".repeat(201))],
  ["big paste stays out of the box", collapsedTextareaEmpty && collapsedStashLines === 30],
  ["pasted row shown, box stays compact", collapsedFrame.includes("Pasted 30 lines") && collapsedHeight === 7],
  ["over-max content collapses to notice", overCapTextareaEmpty && overCapStashLines === 12 && overCapNotice],
  ["idle box has no helper text", idleClean],
  ["busy status stays in the box", busyHasStatus],
  ["permission shows in the prompt", permFrame.includes("permission · bash") && permFrame.includes("$ rm -rf ./tmp && echo hi")],
  ["permission options intact", permFrame.includes("allow once") && permFrame.includes("always allow “rm …”")],
  ["question takes over the prompt", qFrame.includes("question") && qFrame.includes("Pick a colour")],
  ["question options listed", qFrame.includes("1. Red") && qFrame.includes("2. Blue") && qFrame.includes("type your own answer")],
  ["question resolves the pick", resolvedAnswer.kind === "option" && resolvedAnswer.label === "Blue"],
  ["custom row enters typing without touching dead input", typingEntered && !typeFrame.includes("Pick one?")],
  ["typed custom answer lands in the box", typedLanded],
  ["custom answer resolves", resolvedCustom.kind === "custom" && resolvedCustom.text === "my answer"],
  ["palette prefill lands on remount", prefillShown && prefillConsumed],
  ["palette filters while typing", JSON.stringify(filteredLabels) === JSON.stringify(["/model", "/plan"])],
  ["palette shows query + match", palFrame.includes("> mod") && palFrame.includes("/model") && !palFrame.includes("quit")],
  ["palette empty state", emptyPalFrame.includes("(no matches)")],
  ["sidebar shows name + version once", (sideFrame.match(/rokaru/g) ?? []).length === 1 && /v\d+\.\d+\.\d+/.test(sideFrame)],
]

const ok = checks.every(([, v]) => v)
for (const [name, v] of checks) console.log(`${v ? "PASS" : "FAIL"}  ${name}`)
process.exit(ok ? 0 : 1)
