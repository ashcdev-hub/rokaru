/** @jsxImportSource @opentui/solid */
import { onMount } from "solid-js"
import { defaultTextareaKeyBindings, type KeyBinding, type TextareaRenderable } from "@opentui/core"
import { THEME } from "../theme"
import { status } from "../store"

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

export function InputBox(props: {
  onSubmit: (text: string) => void
  focused?: boolean
  height?: number
  onReady?: (handle: InputHandle) => void
  onContentChange?: (value: string) => void
}) {
  let ref: TextareaRenderable | undefined
  const busy = () => status() !== "idle" && status() !== "error"
  const rows = () => Math.max(3, props.height ?? 8)

  const submit = () => {
    if (busy() || !ref) return
    const text = ref.plainText.trim()
    if (text.length === 0) return
    ref.clear()
    props.onContentChange?.("")
    props.onSubmit(text)
  }

  onMount(() =>
    props.onReady?.({
      setText: (text: string) => {
        ref?.setText(text)
        props.onContentChange?.(text)
      },
      getText: () => ref?.plainText ?? "",
      clear: () => {
        ref?.clear()
        props.onContentChange?.("")
      },
      focus: () => ref?.focus(),
    }),
  )

  return (
    <box
      flexDirection="column"
      height={rows() + 2}
      flexShrink={0}
      border
      borderStyle="rounded"
      borderColor={busy() ? THEME.track : THEME.accent}
      title="prompt"
    >
      <box flexDirection="row" height={rows()} paddingLeft={1} paddingRight={1}>
        {/* Left accent line, like opencode's editor gutter */}
        <box width={1} backgroundColor={busy() ? THEME.accent : THEME.blue} marginRight={2} />
        <textarea
          ref={(el: TextareaRenderable) => (ref = el)}
          focused={props.focused ?? true}
          flexGrow={1}
          height={rows()}
          placeholder={busy() ? "working… (esc to abort)" : "message · / for commands · enter send · shift+enter newline"}
          keyBindings={bindings}
          onSubmit={submit}
          onContentChange={() => props.onContentChange?.(ref?.plainText ?? "")}
          textColor={THEME.text}
          focusedTextColor={THEME.text}
          placeholderColor={THEME.dim}
        />
      </box>
    </box>
  )
}
