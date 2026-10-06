/** @jsxImportSource @opentui/solid */
import { onMount } from "solid-js"
import { defaultTextareaKeyBindings, type KeyBinding, type TextareaRenderable } from "@opentui/core"
import { getTheme, sg } from "../theme"
import { mode, model, status } from "../store"

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

  const modeLabel = () => (mode() === "plan" ? "Plan" : "Build")
  const modeColour = () => (mode() === "plan" ? getTheme().plan : getTheme().build)

  return (
    <box
      flexDirection="column"
      height={rows() + 3}
      flexShrink={0}
      border
      borderStyle="rounded"
      borderColor={modeColour()}
    >
      <box flexDirection="row" flexGrow={1} paddingLeft={1} paddingRight={1}>
        {/* Left accent line reflects the mode identity (blue build / purple plan) */}
        <box width={1} backgroundColor={modeColour()} marginRight={2} />
        <box flexDirection="column" flexGrow={1}>
          <textarea
            ref={(el: TextareaRenderable) => (ref = el)}
            focused={props.focused ?? true}
            flexGrow={1}
            height={rows()}
            placeholder={busy() ? "working… (esc to abort)" : "message · / for commands · enter send · shift+enter newline"}
            keyBindings={bindings}
            onSubmit={submit}
            onContentChange={() => props.onContentChange?.(ref?.plainText ?? "")}
            textColor={getTheme().text}
            focusedTextColor={getTheme().text}
            placeholderColor={getTheme().dim}
          />
          {/* Mode · model footer, like opencode's prompt line */}
          <text>
            <span {...sg(modeColour())}>{modeLabel()}</span>
            <span {...sg(getTheme().dim)}>{"  ·  "}</span>
            <span {...sg(getTheme().text)}>{model() || "no model"}</span>
          </text>
        </box>
      </box>
    </box>
  )
}
