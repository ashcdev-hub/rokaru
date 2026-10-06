/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { THEME } from "../theme"
import * as store from "../store"
import { InputBox } from "./InputBox"
import { MessageList } from "./MessageList"
import { PermissionPrompt } from "./PermissionPrompt"
import { Sidebar } from "./Sidebar"
import { Toast } from "./Toast"
import { CommandMenu } from "./CommandMenu"
import { ProgressBar } from "./ProgressBar"
import type { InputHandle } from "./InputBox"

export function ChatView(props: {
  onSubmit: (text: string) => void
  inputHeight: number
  onReady?: (handle: InputHandle) => void
  onContentChange?: (value: string) => void
}) {
  return (
    <box flexDirection="row" width="100%" height="100%">
      <box flexGrow={1} flexDirection="column" overflow="hidden">
        <MessageList />
        <Show when={store.error()}>
          <box border borderStyle="rounded" borderColor={THEME.bad} paddingLeft={1} flexShrink={0}>
            <text fg={THEME.bad}>{`error: ${store.error()}`}</text>
          </box>
        </Show>
        <Show when={store.permission()}>
          {(pending) => <PermissionPrompt request={pending()} />}
        </Show>
        <Show when={store.pendingImages().length > 0}>
          <box flexDirection="row" flexShrink={0} paddingLeft={1}>
            <text fg={THEME.accent}>
              {`📎 ${store.pendingImages().map((image) => image.name).join("  ")}  · send to attach`}
            </text>
          </box>
        </Show>
        <CommandMenu />
        <InputBox
          onSubmit={props.onSubmit}
          focused={!store.permission()}
          height={props.inputHeight}
          onReady={props.onReady}
          onContentChange={props.onContentChange}
        />
        <ProgressBar />
      </box>
      <Sidebar width={34} />
      <Toast />
    </box>
  )
}
