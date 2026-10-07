/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { getTheme } from "../theme"
import * as store from "../store"
import { InputBox } from "./InputBox"
import { MessageList } from "./MessageList"
import { PermissionBody } from "./PermissionPrompt"
import { PromptPanel } from "./PromptPanel"
import { QuestionPanel } from "./QuestionPanel"
import { Sidebar } from "./Sidebar"
import { Toast } from "./Toast"
import { CommandMenu } from "./CommandMenu"
import { MentionMenu } from "./MentionMenu"
import { ProgressBar } from "./ProgressBar"
import type { InputHandle } from "./InputBox"

export function ChatView(props: {
  onSubmit: (text: string) => void
  inputHeight: number
  onReady?: (handle: InputHandle) => void
  onContentChange?: (value: string) => void
}) {
  return (
    <box flexDirection="column" width="100%" height="100%">
      <box flexDirection="row" flexGrow={1}>
        <box flexGrow={1} flexDirection="column" overflow="hidden">
          <MessageList />
          <Show when={store.error()}>
            <box border borderStyle="rounded" borderColor={getTheme().bad} paddingLeft={1} flexShrink={0}>
              <text fg={getTheme().bad}>{`error: ${store.error()}`}</text>
            </box>
          </Show>
          <Show
            when={store.permission()}
            fallback={
              <Show
                when={!store.questionTyping() ? store.question() : undefined}
                fallback={
                  <>
                    <Show when={store.pendingImages().length > 0}>
                      <box flexDirection="row" flexShrink={0} paddingLeft={1}>
                        <text fg={getTheme().accent}>
                          {`📎 ${store.pendingImages().map((image) => image.name).join("  ")}  · send to attach`}
                        </text>
                      </box>
                    </Show>
                    <Show when={store.findNav()}>
                      {(nav) => (
                        <box flexDirection="row" flexShrink={0} paddingLeft={1}>
                          <text fg={getTheme().accent}>
                            {`🔎 ${nav().at + 1}/${nav().hits.length} “${nav().query}” · n next · p prev · esc done`}
                          </text>
                        </box>
                      )}
                    </Show>
                    <CommandMenu />
                    <MentionMenu />
                    <InputBox
                      onSubmit={props.onSubmit}
                      focused={!store.permission() && (!store.question() || store.questionTyping())}
                      height={props.inputHeight}
                      onReady={props.onReady}
                      onContentChange={props.onContentChange}
                    />
                  </>
                }
              >
                {(pending) => (
                  <PromptPanel>
                    <QuestionPanel request={pending()} />
                  </PromptPanel>
                )}
              </Show>
            }
          >
            {(pending) => (
              <PromptPanel>
                <PermissionBody request={pending()} />
              </PromptPanel>
            )}
          </Show>
          {/* Toast lives in the main pane so it never overlaps the sidebar */}
          <Toast />
        </box>
        <Sidebar width={34} />
      </box>
      <ProgressBar />
    </box>
  )
}
