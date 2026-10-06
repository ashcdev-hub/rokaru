/** @jsxImportSource @opentui/solid */
import { createSignal, onMount, Show } from "solid-js"
import { useKeyboard, useRenderer, useSelectionHandler } from "@opentui/solid"
import { runTurn, type TurnOptions } from "./agent"
import { clearProxyEnv } from "./guard"
import { installLifecycle, secureExit } from "./lifecycle"
import { listModels, type ModelInfo } from "./omlx"
import { loadConfig, resolveApiKey } from "./config"
import { copyToClipboard } from "./clipboard"
import { THEME } from "./theme"
import { VERSION } from "./version"
import * as store from "./store"
import { ModelPicker } from "./components/ModelPicker"
import { AsciiLogo } from "./components/AsciiLogo"
import { ChatView } from "./components/ChatView"
import { SwitchModel } from "./components/SwitchModel"

type Phase = "loading" | "pick" | "ready" | "error"

export function App() {
  const renderer = useRenderer()
  const [phase, setPhase] = createSignal<Phase>("loading")
  const [loadError, setLoadError] = createSignal<string>("")
  let controller: AbortController | undefined

  const config = loadConfig()
  clearProxyEnv()
  const workspace = process.env.ROKARU_WORKSPACE || process.cwd()

  onMount(() => {
    installLifecycle(renderer)
    store.setWorkspace(workspace)
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

  const runCommand = (raw: string) => {
    const [name, ...rest] = raw.slice(1).trim().split(/\s+/)
    const arg = rest.join(" ").trim()
    switch (name) {
      case "model":
      case "models": {
        if (arg.length > 0) {
          const match = store.models().find((m) => m.id.toLowerCase().includes(arg.toLowerCase()))
          if (match) applyModel(match)
          else store.showToast(`no model matching “${arg}”`)
        } else {
          store.setSwitchingModel(true)
        }
        return
      }
      default:
        store.showToast(`unknown command: /${name}`)
    }
  }

  const submit = (text: string) => {
    if (busy()) return
    if (text.startsWith("/")) {
      runCommand(text)
      return
    }
    controller = new AbortController()
    const options: TurnOptions = {
      baseURL: config.baseURL,
      apiKey: resolveApiKey(),
      model: store.model(),
      modelLimit: store.modelLimit(),
      config,
      workspace,
      signal: controller.signal,
    }
    void runTurn(options, text).finally(() => {
      controller = undefined
    })
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

    if (store.switchingModel()) {
      if (key.name === "escape") {
        key.preventDefault()
        store.setSwitchingModel(false)
      }
      // The focused select handles ↑/↓/enter.
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
        store.answerPermission(store.permissionChoice() === 0)
      } else if (key.name === "y") {
        key.preventDefault()
        store.answerPermission(true)
      } else if (key.name === "n" || key.name === "escape") {
        key.preventDefault()
        store.answerPermission(false)
      }
      return
    }

    if (key.name === "escape" && busy()) {
      key.preventDefault()
      controller?.abort()
      return
    }

    if (key.ctrl && key.name === "r") {
      key.preventDefault()
      store.setShowReasoning(!store.showReasoning())
    }
  })

  const chooseModel = (model: ModelInfo) => {
    applyModel(model)
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
        fallback={<ChatView onSubmit={submit} inputHeight={config.inputHeight} />}
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
        <text fg={THEME.dim}>private · ephemeral harness for oMLX</text>
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
