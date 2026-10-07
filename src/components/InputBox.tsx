/** @jsxImportSource @opentui/solid */
import { createSignal, onMount, Show } from "solid-js"
import { defaultTextareaKeyBindings, type KeyBinding, type TextareaRenderable } from "@opentui/core"
import { usePaste, useTerminalDimensions } from "@opentui/solid"
import { getTheme } from "../theme"
import { pastedLineCount, pastedText, questionTyping, setPastedText, status } from "../store"
import { PromptPanel } from "./PromptPanel"

const bindings: KeyBinding[] = [
  ...defaultTextareaKeyBindings.filter((b) => b.action !== "submit" && b.action !== "newline"),
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

export function shouldCollapsePaste(text: string): boolean {
  if (text.length === 0) return false
  return text.split("\n").length > PASTE_COLLAPSE_LINES || text.length > PASTE_COLLAPSE_CHARS
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
  const maxRows = () => Math.max(MIN_ROWS, props.height ?? DEFAULT_MAX_ROWS)
  const [content, setContent] = createSignal("")

  usePaste((event: any) => {
    const text = new TextDecoder().decode(event.bytes ?? new Uint8Array())
    if (!shouldCollapsePaste(text)) return
    event.preventDefault()
    setPastedText((prev) => (prev ? `${prev}\n${text}` : text))
  })

  const innerWidth = () => Math.max(20, (dims()?.width ?? 100) - 34 - 7)
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
    const text = ref.plainText.trim()
    if (text.length === 0 && pastedText().length === 0) return
    ref.clear()
    setContent("")
    props.onContentChange?.("")
    props.onSubmit(text)
  }

  let collapsing = false
  const track = (value: string) => {
    if (!collapsing && value.length > 0 && neededRows(value) > maxRows()) {
      collapsing = true
      try {
        setPastedText((prev) => (prev ? `${prev}\n${value}` : value))
        ref?.clear()
        setContent("")
        props.onContentChange?.("")
      } finally {
        collapsing = false
      }
      return
    }
    setContent(value)
    props.onContentChange?.(value)
  }

  onMount(() =>
    props.onReady?.({
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
    }),
  )

  return (
    <PromptPanel height={rows() + 3 + (pastedLineCount() > 0 ? 1 : 0)}>
      <Show when={pastedLineCount() > 0}>
        <text fg={getTheme().accent}>
          {`📎 Pasted ${pastedLineCount()} line${pastedLineCount() === 1 ? "" : "s"} · send with your message · ⌫ to drop`}
        </text>
      </Show>
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
