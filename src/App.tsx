/** @jsxImportSource @opentui/solid */
import { createSignal, onMount, Show } from "solid-js"
import { useKeyboard, useRenderer, useSelectionHandler } from "@opentui/solid"
import { runTurn, compactHistory, resetHistory, type TurnOptions } from "./agent"
import { clearProxyEnv } from "./guard"
import { installLifecycle, secureExit } from "./lifecycle"
import { listModels, type ModelInfo } from "./omlx"
import { loadConfig, resolveApiKey } from "./config"
import { copyToClipboard } from "./clipboard"
import { COMMANDS, matchCommands } from "./commands"
import { imageDataUrl } from "./image"
import { isAbsolute, resolve } from "node:path"
import { THEME } from "./theme"
import { VERSION } from "./version"
import * as store from "./store"
import { ModelPicker } from "./components/ModelPicker"
import { AsciiLogo } from "./components/AsciiLogo"
import { ChatView } from "./components/ChatView"
import { SwitchModel } from "./components/SwitchModel"
import type { InputHandle } from "./components/InputBox"

type Phase = "loading" | "pick" | "ready" | "error"

export function App() {
  const renderer = useRenderer()
  const [phase, setPhase] = createSignal<Phase>("loading")
  const [loadError, setLoadError] = createSignal<string>("")
  let controller: AbortController | undefined

  const config = loadConfig()
  clearProxyEnv()
  const workspace = process.env.ROKARU_WORKSPACE || process.cwd()

  let inputHandle: InputHandle | undefined
  let queued: string | undefined
  const sentHistory: string[] = []
  let historyIndex = 0
  let navigating = false
  let suppressChange = false

  onMount(() => {
    installLifecycle(renderer)
    store.setWorkspace(workspace)
    store.setWebEnabled(config.web?.enabled === true)
    if (config.web?.enabled) store.showToast("web access enabled (read-only)")
    void (async () => {
      try {
        const models = await listModels({ baseURL: config.baseURL, apiKey: resolveApiKey() })
        if (models.length === 0) {
          setLoadError("oMLX returned no models. Load a model in oMLX, then relaunch rokaru.")
          setPhase("error")
          return
        }
        store.setModels(models)
        setPhase("pick")
      } catch (err) {
        setLoadError(
          `Cannot reach oMLX at ${config.baseURL}: ${(err as Error).message}\n` +
            "Start oMLX yourself, then relaunch rokaru.",
        )
        setPhase("error")
      }
    })()
  })

  const busy = () => {
    const s = store.status()
    return s === "thinking" || s === "streaming" || s === "tool" || s === "permission"
  }

  const applyModel = (model: ModelInfo) => {
    store.setModel(model.id)
    store.setModelLimit(model.maxModelLen)
    store.showToast(`model · ${model.id}`)
  }

  const options = (signal: AbortSignal): TurnOptions => ({
    baseURL: config.baseURL,
    apiKey: resolveApiKey(),
    model: store.model(),
    modelLimit: store.modelLimit(),
    config,
    workspace,
    signal,
  })

  const menuMatches = () => {
    const value = store.inputValue()
    if (!value.startsWith("/") || value.includes(" ")) return []
    return matchCommands(value.slice(1))
  }

  const showHelp = () => {
    store.addInfoMessage(
      [
        "commands:",
        "  /model [name]   switch model (or open the picker)",
        "  /image <path>   attach an image to your next message",
        "  /compact        summarise the conversation to free context",
        "  /clear          clear the conversation",
        "  /new            start a new conversation",
        "  /help           show this list",
        "",
        "keys:  enter send · shift+enter newline · esc abort · ctrl+r reasoning",
        "       ctrl+o expand tool output · ctrl+c quit",
        "mouse: select any text to copy it to the clipboard",
      ].join("\n"),
    )
  }

  const newConversation = (message: string) => {
    store.resetSession()
    resetHistory()
    store.showToast(message)
  }

  const runCommand = (raw: string) => {
    const [name, ...rest] = raw.slice(1).trim().split(/\s+/)
    const arg = rest.join(" ").trim()
    const exact = COMMANDS.find((c) => c.name === name)
    const prefix = matchCommands(name)
    const spec = exact ?? (prefix.length === 1 ? prefix[0] : undefined)
    if (!spec) {
      if (prefix.length > 1) store.showToast(`ambiguous: ${prefix.map((c) => `/${c.name}`).join(", ")}`)
      else store.showToast(`unknown command: /${name}`)
      return
    }
    switch (spec.name) {
      case "model": {
        if (arg.length > 0) {
          const match = store.models().find((m) => m.id.toLowerCase().includes(arg.toLowerCase()))
          if (match) applyModel(match)
          else store.showToast(`no model matching “${arg}”`)
        } else {
          store.setSwitchingModel(true)
        }
        return
      }
      case "help":
        showHelp()
        return
      case "image": {
        if (arg.length === 0) {
          store.showToast("usage: /image <path-to-image>")
          return
        }
        const target = isAbsolute(arg) ? arg : resolve(workspace, arg)
        try {
          const { dataUrl, bytes } = imageDataUrl(target)
          store.addPendingImage({ name: `${arg} (${Math.round(bytes / 1024)} KB)`, dataUrl })
          store.showToast(`attached ${arg}`)
        } catch (err) {
          store.showToast(`image: ${(err as Error).message}`)
        }
        return
      }
      case "clear":
      case "new":
        newConversation("conversation cleared")
        return
      case "compact": {
        if (busy()) {
          store.showToast("busy — try /compact when idle")
          return
        }
        const controller = new AbortController()
        void compactHistory(options(controller.signal))
        return
      }
    }
  }

  const send = (text: string) => {
    const attachments = store.pendingImages()
    store.clearPendingImages()
    sentHistory.push(text)
    historyIndex = sentHistory.length
    navigating = false
    controller = new AbortController()
    void runTurn({ ...options(controller.signal), attachments }, text).finally(() => {
      controller = undefined
      if (queued !== undefined) {
        const next = queued
        queued = undefined
        queueMicrotask(() => submit(next))
      }
    })
  }

  const submit = (text: string) => {
    if (busy()) {
      queued = text
      store.showToast("queued — will send when the model is free")
      return
    }
    if (text.startsWith("/")) {
      runCommand(text)
      return
    }
    send(text)
  }

  const recall = (delta: number) => {
    if (!inputHandle || sentHistory.length === 0) return
    historyIndex = Math.max(0, Math.min(sentHistory.length, historyIndex + delta))
    navigating = true
    suppressChange = true
    inputHandle.setText(historyIndex >= sentHistory.length ? "" : sentHistory[historyIndex])
    suppressChange = false
  }

  const onContentChange = (value: string) => {
    if (!suppressChange) {
      historyIndex = sentHistory.length
      navigating = false
    }
    store.setInputValue(value)
    store.setMenuIndex(0)
  }

  // Auto-copy any text selection to the clipboard, with a small toast.
  let lastCopied = ""
  useSelectionHandler((selection) => {
    const text = selection.getSelectedText()
    if (!text || text.trim().length === 0) {
      lastCopied = ""
      return
    }
    if (text === lastCopied) return
    lastCopied = text
    copyToClipboard(text)
    store.showToast("copied to clipboard")
  })

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      secureExit(renderer, 130)
      return
    }

    if (key.ctrl && key.name === "r") {
      key.preventDefault()
      store.setShowReasoning(!store.showReasoning())
      return
    }

    if (key.ctrl && key.name === "o") {
      key.preventDefault()
      store.setExpandTools(!store.expandTools())
      return
    }

    if (store.switchingModel()) {
      if (key.name === "escape") {
        key.preventDefault()
        store.setSwitchingModel(false)
      }
      return
    }

    const pending = store.permission()
    if (pending) {
      if (key.name === "up") {
        key.preventDefault()
        store.movePermissionChoice(-1)
      } else if (key.name === "down") {
        key.preventDefault()
        store.movePermissionChoice(1)
      } else if (key.name === "return" || key.name === "enter") {
        key.preventDefault()
        store.answerPermission(store.PERMISSION_DECISIONS[store.permissionChoice()] ?? "deny")
      } else if (key.name === "y") {
        key.preventDefault()
        store.answerPermission("once")
      } else if (key.name === "a") {
        key.preventDefault()
        store.answerPermission("always")
      } else if (key.name === "n" || key.name === "escape") {
        key.preventDefault()
        store.answerPermission("deny")
      }
      return
    }

    if (key.name === "escape" && busy()) {
      key.preventDefault()
      controller?.abort()
      return
    }

    // Menu/history keys only apply to the chat prompt, not the model picker.
    if (phase() === "ready" && !busy()) {
      const matches = menuMatches()
      if (matches.length > 0) {
        if (key.name === "up") {
          key.preventDefault()
          store.setMenuIndex(Math.max(0, store.menuIndex() - 1))
          return
        }
        if (key.name === "down") {
          key.preventDefault()
          store.setMenuIndex(Math.min(matches.length - 1, store.menuIndex() + 1))
          return
        }
        if (key.name === "tab") {
          key.preventDefault()
          const chosen = matches[Math.min(store.menuIndex(), matches.length - 1)]
          suppressChange = true
          inputHandle?.setText(`/${chosen.name} `)
          suppressChange = false
          store.setMenuIndex(0)
          return
        }
      }
      if ((key.name === "up" && (navigating || store.inputValue() === "")) || (key.name === "down" && navigating)) {
        key.preventDefault()
        recall(key.name === "up" ? -1 : 1)
        return
      }
    }
  })

  const chooseModel = (model: ModelInfo) => {
    applyModel(model)
    store.setInputValue("")
    setPhase("ready")
  }

  const switchTo = (model: ModelInfo) => {
    applyModel(model)
    store.setSwitchingModel(false)
  }

  return (
    <Show
      when={phase() === "ready"}
      fallback={<Startup phase={phase()} message={loadError()} models={store.models()} onSelect={chooseModel} />}
    >
      <Show
        when={store.switchingModel()}
        fallback={
          <ChatView
            onSubmit={submit}
            inputHeight={config.inputHeight}
            onReady={(handle) => (inputHandle = handle)}
            onContentChange={onContentChange}
          />
        }
      >
        <SwitchModel baseURL={config.baseURL} apiKey={resolveApiKey()} onSelect={switchTo} />
      </Show>
    </Show>
  )
}

export function Startup(props: {
  phase: Phase
  message: string
  models: ModelInfo[]
  onSelect: (model: ModelInfo) => void
}) {
  return (
    <box width="100%" height="100%" flexDirection="column" justifyContent="center" alignItems="center">
      <box flexDirection="column" alignItems="center">
        <AsciiLogo />
        <text fg={THEME.dim}>private local harness for oMLX</text>
        <text fg={THEME.accent}>{`v${VERSION}`}</text>
        <text fg={THEME.text}>{""}</text>
        <Show when={props.phase === "pick"}>
          <ModelPicker models={props.models} onSelect={props.onSelect} />
        </Show>
        <Show when={props.phase === "loading"}>
          <text fg={THEME.dim}>contacting oMLX…</text>
        </Show>
        <Show when={props.phase === "error"}>
          <text fg={THEME.bad}>{props.message}</text>
        </Show>
        <text fg={THEME.text}>{""}</text>
        <text fg={THEME.dim}>ctrl+c to quit</text>
      </box>
    </box>
  )
}
