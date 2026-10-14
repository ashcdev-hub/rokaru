/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { getTheme } from "../theme"
import * as store from "../store"
import { InputBox } from "./InputBox"
import { MessageList } from "./MessageList"
import { PermissionBody } from "./PermissionPrompt"
import { PromptPanel } from "./PromptPanel"
import { QuestionPanel } from "./QuestionPanel"
import { ConfirmPrompt } from "./ConfirmPrompt"
import { InterruptPanel } from "./InterruptPanel"
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
                  <Show
                    when={store.interruptMenu()}
                    fallback={
                      <Show
                        when={store.confirmRequest()}
                        fallback={
                          <>
                            <Show when={store.pendingImages().length > 0}>
                              <box flexDirection="row" flexShrink={0} paddingLeft={1}>
                                <text fg={getTheme().accent}>
                                  {`📎 ${store.pendingImages().map((image) => image.name).join("  ")}  · send to attach`}
                                </text>
                              </box>
                            </Show>
                            <CommandMenu />
                            <MentionMenu />
                            <InputBox
                              onSubmit={props.onSubmit}
                              focused={
                                !store.permission() &&
                                (!store.question() || store.questionTyping()) &&
                                !store.interruptMenu() &&
                                !store.confirmRequest()
                              }
                              height={props.inputHeight}
                              onReady={props.onReady}
                              onContentChange={props.onContentChange}
                            />
                          </>
                        }
                      >
                        {(pending) => (
                          <PromptPanel>
                            <ConfirmPrompt request={pending()} />
                          </PromptPanel>
                        )}
                      </Show>
                    }
                  >
                    <PromptPanel>
                      <InterruptPanel />
                    </PromptPanel>
                  </Show>
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
        <Show when={store.sidebarVisible()}>
          <Sidebar width={34} />
        </Show>
      </box>
      <ProgressBar />
    </box>
  )
}
