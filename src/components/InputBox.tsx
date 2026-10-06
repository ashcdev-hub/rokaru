/** @jsxImportSource @opentui/solid */
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

export function InputBox(props: { onSubmit: (text: string) => void; focused?: boolean; height?: number }) {
  let ref: TextareaRenderable | undefined
  const busy = () => status() !== "idle" && status() !== "error"
  const rows = () => Math.max(3, props.height ?? 8)

  const submit = () => {
    if (busy() || !ref) return
    const text = ref.plainText.trim()
    if (text.length === 0) return
    ref.clear()
    props.onSubmit(text)
  }

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
      <textarea
        ref={(el: TextareaRenderable) => (ref = el)}
        focused={props.focused ?? true}
        height={rows()}
        placeholder={busy() ? "working… (esc to abort)" : "message · /model to switch · enter send · shift+enter newline"}
        keyBindings={bindings}
        onSubmit={submit}
        textColor={THEME.text}
        focusedTextColor={THEME.text}
        placeholderColor={THEME.dim}
      />
    </box>
  )
}
