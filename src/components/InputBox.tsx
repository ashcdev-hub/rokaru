/** @jsxImportSource @opentui/solid */
import { createSignal, onMount } from "solid-js"
import { defaultTextareaKeyBindings, SyntaxStyle, type KeyBinding, type TextareaRenderable } from "@opentui/core"
import { usePaste, useTerminalDimensions } from "@opentui/solid"
import { getTheme } from "../theme"
import {
  addPasteBlock,
  clearPasteBlocks,
  consumeInputPrefill,
  expandPasteBlocks,
  inputHeightOverride,
  inputValue,
  pasteBlocks,
  questionTyping,
  setPasteBlocks,
  sidebarCols,
  status,
} from "../store"
import { PromptPanel } from "./PromptPanel"

const bindings: KeyBinding[] = [
  // Drop submit/newline (we rebind below) and ctrl+a (line-home) so the global
  // "copy whole session" shortcut can use it.
  ...defaultTextareaKeyBindings.filter(
    (b) => b.action !== "submit" && b.action !== "newline" && !(b.ctrl && b.name === "a" && !b.shift),
  ),
  { name: "return", action: "submit" },
  { name: "kpenter", action: "submit" },
  { name: "return", shift: true, action: "newline" },
  { name: "return", meta: true, action: "newline" },
  { name: "return", ctrl: true, action: "newline" },
  { name: "linefeed", action: "newline" },
]

export interface InputHandle {
  setText(text: string): void
  getText(): string
  clear(): void
  focus(): void
}

const MIN_ROWS = 3
const DEFAULT_MAX_ROWS = 10
const PASTE_COLLAPSE_LINES = 3
const PASTE_COLLAPSE_CHARS = 200

// Anything bigger than a couple of lines (or one long line) is collapsed to a
// short "[Pasted N lines]" token instead of being inserted verbatim.
export function shouldCollapsePaste(text: string): boolean {
  if (text.length === 0) return false
  return text.split("\n").length > PASTE_COLLAPSE_LINES || text.length > PASTE_COLLAPSE_CHARS
}

// A single syntax style/background used for pasted ranges. Built lazily on the
// first InputBox mount (the native render lib must be up first).
const PASTE_STYLE_NAME = "rokaru.paste"
let pasteStyle: SyntaxStyle | undefined
let pasteStyleId = -1
function ensurePasteStyle(): number {
  try {
    if (!pasteStyle) {
      pasteStyle = SyntaxStyle.fromStyles({ [PASTE_STYLE_NAME]: { bg: getTheme().track } })
      pasteStyleId = pasteStyle.resolveStyleId(PASTE_STYLE_NAME) ?? -1
    }
  } catch {
    pasteStyleId = -1
  }
  return pasteStyleId
}

export function InputBox(props: {
  onSubmit: (text: string) => void
  focused?: boolean
  height?: number
  onReady?: (handle: InputHandle) => void
  onContentChange?: (value: string) => void
}) {
  let ref: TextareaRenderable | undefined
  const dims = useTerminalDimensions()
  const busy = () => status() !== "idle" && status() !== "error"
  const maxRows = () => Math.max(MIN_ROWS, inputHeightOverride() ?? props.height ?? DEFAULT_MAX_ROWS)
  const [content, setContent] = createSignal("")

  usePaste((event: any) => {
    const text = new TextDecoder().decode(event.bytes ?? new Uint8Array())
    if (!shouldCollapsePaste(text)) return
    // Collapse the paste to a highlighted token, inserted at the cursor.
    event.preventDefault()
    ref?.insertText(addPasteBlock(text))
  })

  const innerWidth = () => Math.max(20, (dims()?.width ?? 100) - sidebarCols() - 7)
  const neededRows = (text: string) => {
    let needed = 0
    for (const line of text.split("\n")) {
      needed += Math.max(1, Math.ceil(line.length / innerWidth()))
    }
    return needed
  }
  const rows = () => Math.min(maxRows(), Math.max(MIN_ROWS, neededRows(content())))

  const submit = () => {
    if (!ref) return
    if (busy() && !questionTyping()) return
    const text = expandPasteBlocks(ref.plainText).trim()
    if (text.length === 0) return
    ref.clear()
    setContent("")
    clearPasteBlocks()
    props.onContentChange?.("")
    props.onSubmit(text)
  }

  // Highlights track the paste tokens by rescanning on every change, so a
  // deleted or edited token never leaves its highlight behind.
  const syncPasteHighlights = (value: string) => {
    const styleId = ensurePasteStyle()
    if (styleId < 0 || !ref) return
    ref.clearAllHighlights()
    for (const block of pasteBlocks()) {
      let from = 0
      for (;;) {
        const at = value.indexOf(block.label, from)
        if (at < 0) break
        ref.addHighlightByCharRange({ start: at, end: at + block.label.length, styleId })
        from = at + block.label.length
      }
    }
  }

  const track = (value: string) => {
    setContent(value)
    syncPasteHighlights(value)
    // Drop any stashed paste whose token is no longer in the draft.
    const live = pasteBlocks().filter((block) => value.includes(block.label))
    if (live.length !== pasteBlocks().length) setPasteBlocks(live)
    props.onContentChange?.(value)
  }

  onMount(() => {
    const handle: InputHandle = {
      setText: (text: string) => {
        ref?.setText(text)
        track(text)
      },
      getText: () => ref?.plainText ?? "",
      clear: () => {
        ref?.clear()
        track("")
      },
      focus: () => ref?.focus(),
    }
    props.onReady?.(handle)
    if (ref && ensurePasteStyle() >= 0 && pasteStyle) ref.syntaxStyle = pasteStyle
    // Keep the draft across screen changes (palette, MCP/theme panels, model
    // picker): restore whatever was last in the box, unless a command prefill
    // is explicitly replacing it.
    const prefill = consumeInputPrefill()
    const restore = prefill.length > 0 ? prefill : inputValue()
    if (restore.length > 0) {
      ref?.setText(restore)
      track(restore)
    }
  })

  return (
    <PromptPanel height={rows() + 3}>
      <textarea
        ref={(el: TextareaRenderable) => (ref = el)}
        focused={props.focused ?? true}
        flexGrow={1}
        height={rows()}
        placeholder={busy() ? "working… (esc to abort)" : ""}
        keyBindings={bindings}
        onSubmit={submit}
        onContentChange={() => track(ref?.plainText ?? "")}
        textColor={getTheme().text}
        focusedTextColor={getTheme().text}
        placeholderColor={getTheme().dim}
      />
    </PromptPanel>
  )
}
