/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { THEME } from "../theme"
import * as store from "../store"
import { InputBox } from "./InputBox"
import { MessageList } from "./MessageList"
import { PermissionPrompt } from "./PermissionPrompt"
import { Sidebar } from "./Sidebar"
import { Toast } from "./Toast"

export function ChatView(props: { onSubmit: (text: string) => void; inputHeight: number }) {
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
        <InputBox onSubmit={props.onSubmit} focused={!store.permission()} height={props.inputHeight} />
      </box>
      <Sidebar width={34} />
      <Toast />
    </box>
  )
}
