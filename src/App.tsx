/** @jsxImportSource @opentui/solid */
import { createSignal, onMount, Show } from "solid-js"
import { useKeyboard, useRenderer, useSelectionHandler } from "@opentui/solid"
import { runTurn, compactHistory, resetHistory, type TurnOptions } from "./agent"
import { clearProxyEnv } from "./guard"
import { installLifecycle, secureExit } from "./lifecycle"
import { isOmlxServerRunning, purgeOmlxSessionCache } from "./omlxCache"
import {
  collectDiskState,
  formatPrivacyReport,
  generateCanary,
  omlxRoot,
  scanForText,
  sendCanaryProbe,
} from "./privacyCheck"
import { listModels, streamChat, type ModelInfo } from "./omlx"
import { CONFIG_DIR, loadConfig, resolveApiKey } from "./config"
import * as learning from "./learning"
import { copyToClipboard } from "./clipboard"
import { COMMANDS, matchCommands, resolveCommandName } from "./commands"
import { imageDataUrl } from "./image"
import { applyMention, mentionMatches } from "./fileMentions"
import { friendlyError } from "./errors"
import { listSnapshots, redoLast, undoLast } from "./undo"
import { connectServer, disconnectServer } from "./mcp"
import { registerDynamicTools, unregisterDynamicTools } from "./tools"
import { discoverSkills, invocableSkills } from "./skills"
import { detectGit } from "./git"
import { isAbsolute, resolve } from "node:path"
import { getTheme, activeThemeName, setCurrentTheme, addCustomTheme, themeNames, THEMES, THEME_ROLES, THEME_COLOURS } from "./theme"
import { VERSION } from "./version"
import * as store from "./store"
import { ModelPicker } from "./components/ModelPicker"
import { AsciiLogo } from "./components/AsciiLogo"
import { loadLogo } from "./ascii"
import { startupContentCols, startupContentRows } from "./startupLayout"
import { ChatView } from "./components/ChatView"
import { SwitchModel } from "./components/SwitchModel"
import { CommandPalette, filterPaletteActions, type PaletteAction } from "./components/CommandPalette"
import { McpPanel } from "./components/McpPanel"
import { SkillsPanel } from "./components/SkillsPanel"
import { scrollTranscriptToBottom, scrollTranscriptToMessage } from "./components/MessageList"
import { ThemePanel } from "./components/ThemePanel"
import { StartupBackground } from "./components/StartupBackground"
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
  let lastRecalled = ""
  const mcpToolNames = new Map<string, string[]>()
  const updateMcpStatus = (name: string, patch: Partial<store.McpServerInfo>) => {
    store.setMcpServers((prev) => prev.map((server) => (server.name === name ? { ...server, ...patch } : server)))
  }

  onMount(() => {
    installLifecycle(renderer)
    store.setWorkspace(workspace)
    learning.configure({
      enabled: config.learning.enabled,
      persist: config.learning.persist,
      minRuns: config.learning.minRuns,
      path: `${CONFIG_DIR}/learning.json`,
    })
    const git = detectGit(workspace)
    if (git.branch.length > 0) store.setGitBranch(git.branch + (git.dirty ? "*" : ""))
    store.setWebEnabled(config.web?.enabled === true)
    if (config.web?.enabled) store.showToast("web access enabled (read-only)", "info")
    // MCP servers are opt-in per session: never autostart, so a fresh launch
    // always has none connected (fast prompt, no extra tool schemas).
    const mcpEntries = Object.entries(config.mcp?.servers ?? {})
    store.setMcpServers(mcpEntries.map(([name]) => ({ name, status: "disabled" as const, tools: 0 })))
    // Skills are discovered once on launch (RAM only). They are a static set
    // for the session; reloading them is not needed.
    store.setSkillList(discoverSkills(config.skills, workspace))
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
        setLoadError(`${friendlyError(err, { baseURL: config.baseURL })}\nStart oMLX yourself, then relaunch rokaru.`)
        setPhase("error")
      }
    })()
  })

  const busy = () => {
    const s = store.status()
    return s === "thinking" || s === "streaming" || s === "tool" || s === "permission"
  }

  // Best-effort warm-up so the first real prompt doesn't pay the model-load /
  // cold-prefill cost. Fired in the background; failures are ignored.
  const warmUp = (modelId: string) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 120_000)
    void (async () => {
      try {
        for await (const event of streamChat(
          { baseURL: config.baseURL, apiKey: resolveApiKey() },
          { model: modelId, messages: [{ role: "user", content: "hi" }], maxTokens: 1, temperature: 0 },
          controller.signal,
        )) {
          if (event.type === "finish") break
        }
      } catch {
        // ignore: warm-up is optional
      } finally {
        clearTimeout(timer)
      }
    })()
  }

  const applyModel = (model: ModelInfo) => {
    store.setModel(model.id)
    store.setModelLimit(model.maxModelLen)
    store.showToast(`model · ${model.id}`)
    warmUp(model.id)
  }

  const options = (signal: AbortSignal): TurnOptions => ({
    baseURL: config.baseURL,
    apiKey: resolveApiKey(),
    model: store.model(),
    modelLimit: store.modelLimit(),
    config,
    workspace,
    signal,
    skills: invocableSkills(store.skillList()),
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
        "  /plan | /build   read-only planning mode / full editing mode",
        "  /image <path>   attach an image to your next message",
        "  /compact        summarise the conversation to free context",
        "  /undo [list]    revert the model's last file edit (or list the stack)",
        "  /redo           re-apply the last undone edit",
        "  /tune           show the self-tuning scoreboard (which model works best)",
        "  /good | /bad     label the last turn to train the scoreboard",
        "  /allow-all      auto-approve all tool calls for this session (toggle)",
        "  /find <text>    search the conversation",
        "  /clear          clear the conversation",
        "  /new            start a new conversation",
        "  /help           show this list",
        "  /mcp            list connected MCP servers",
        "  /skills         list available skills",
        "  /purge-cache    delete oMLX session KV-cache (server must be stopped)",
        "  /privacy-check  send a canary request and scan oMLX for leaked session data",
        "  /themes         switch colour theme",
        "  /exit           quit (/quit works too)",
        "",
        "keys:  enter send · shift+enter newline · tab plan/build · esc abort",
        "       ctrl+r reasoning · ctrl+o expand tools · ctrl+p commands · ctrl+c quit",
        "mouse: select any text to copy it to the clipboard",
      ].join("\n"),
    )
  }

  const findInTranscript = (query: string) => {
    const hits = store.findMessageHits(query)
    if (hits.length === 0) {
      store.addInfoMessage(`no matches for “${query}”`)
      return
    }
    store.setFindNav({ query, hits, at: 0 })
    // Defer so the (possibly windowed) transcript has re-rendered in full first.
    setTimeout(() => scrollTranscriptToMessage(hits[0] ?? 0), 0)
  }

  const stepFindNav = (delta: number) => {
    const nav = store.findNav()
    if (!nav || nav.hits.length === 0) return
    const at = (nav.at + delta + nav.hits.length) % nav.hits.length
    store.setFindNav({ ...nav, at })
    scrollTranscriptToMessage(nav.hits[at] ?? 0)
  }

  const newConversation = (message: string) => {
    store.resetSession()
    resetHistory()
    store.showToast(message)
  }

  const runPrivacyCheck = async () => {
    const model = store.model()
    if (!model) {
      store.showToast("select a model first", "warn")
      return
    }
    const canary = generateCanary()
    store.addInfoMessage(`privacy-check: sending a canary request to ${model}…`)
    const probe = new AbortController()
    const timeout = setTimeout(() => probe.abort(), 120_000)
    try {
      await sendCanaryProbe({ baseURL: config.baseURL, apiKey: resolveApiKey() }, model, canary, probe.signal)
    } catch (err) {
      store.addInfoMessage(
        `privacy-check: could not complete the probe request: ${friendlyError(err, {
          baseURL: config.baseURL,
          model,
        })}\nNo oMLX traffic to test, so no scan was run.`,
      )
      return
    } finally {
      clearTimeout(timeout)
    }
    const root = omlxRoot()
    const scan = scanForText(root, canary, { excludeDirs: ["models"] })
    const state = collectDiskState(root)
    store.addInfoMessage(formatPrivacyReport(canary, scan, state).message)
  }

  const suggestedCategories = new Set<string>()

  const tuneMessage = () => {
    const rows = learning.scoreboard()
    if (rows.length === 0) {
      return "tune: no outcomes recorded yet. Work on a few tasks, then use /good or /bad to label them."
    }
    const lines = ["tune scoreboard (wins/losses):"]
    for (const row of rows) {
      const rate = Math.round(learning.successRate(row) * 100)
      const label = learning.CATEGORY_LABELS[row.category]
      lines.push(`  ${label.padEnd(18)} ${row.model.padEnd(30)} ${row.wins}/${row.wins + row.losses}  ${rate}%`)
    }
    const best = learning.overallBest()
    if (best) {
      lines.push(`\nbest overall: ${best.model} (${Math.round(best.winRate * 100)}% over ${best.wins + best.losses} runs)`)
    }
    const category = learning.lastCategory()
    if (category) {
      const pick = learning.suggestion(category)
      if (pick) {
        lines.push(
          `for ${learning.CATEGORY_LABELS[category]}: try ${pick.model} at temp ${pick.sampling.temperature}, rep ${pick.sampling.repetitionPenalty} (${Math.round(pick.winRate * 100)}% over ${pick.runs})`,
        )
      }
    }
    lines.push("\nscorecard is in-memory only unless learning.persist is enabled; never stores prompt or code.")
    return lines.join("\n")
  }

  const runCommand = (raw: string) => {
    const [rawName, ...rest] = raw.slice(1).trim().split(/\s+/)
    const arg = rest.join(" ").trim()
    const name = resolveCommandName(rawName)
    const exact = COMMANDS.find((c) => c.name === name)
    const prefix = matchCommands(name)
    const spec = exact ?? (prefix.length === 1 ? prefix[0] : undefined)
    if (!spec) {
      if (prefix.length > 1) store.showToast(`ambiguous: ${prefix.map((c) => `/${c.name}`).join(", ")}`, "warn")
      else store.showToast(`unknown command: /${name}`, "warn")
      return
    }
    switch (spec.name) {
      case "model": {
        if (arg.length > 0) {
          const match = store.models().find((m) => m.id.toLowerCase().includes(arg.toLowerCase()))
          if (match) applyModel(match)
          else store.showToast(`no model matching “${arg}”`, "warn")
        } else {
          store.setSwitchingModel(true)
        }
        return
      }
      case "help":
        showHelp()
        return
      case "plan":
        store.setMode("plan")
        store.showToast("plan mode — read-only")
        return
      case "build":
        store.setMode("build")
        store.showToast("build mode")
        return
      case "find": {
        if (arg.length === 0) {
          store.showToast("usage: /find <text>")
          return
        }
        findInTranscript(arg)
        return
      }
      case "undo": {
        if (arg === "list") {
          const items = listSnapshots(10)
          store.addInfoMessage(
            items.length === 0
              ? "undo: nothing on the stack."
              : `undo stack (most recent first):\n${items.map((s) => `  ${s.label}  ${s.path}`).join("\n")}`,
          )
          return
        }
        const undone = undoLast()
        if (undone) learning.markUndone()
        store.showToast(undone ?? "nothing to undo")
        return
      }
      case "redo": {
        store.showToast(redoLast() ?? "nothing to redo")
        return
      }
      case "good": {
        learning.addFeedback("good")
        store.showToast("tune: noted as good")
        return
      }
      case "bad": {
        learning.addFeedback("bad")
        store.showToast("tune: noted as bad")
        return
      }
      case "tune": {
        store.addInfoMessage(tuneMessage())
        return
      }
      case "allow-all": {
        const next = !store.autoApprove()
        store.setAutoApprove(next)
        store.showToast(
          next ? "all tools auto-approved (this session)" : "tool approvals restored",
          next ? "warn" : "info",
        )
        return
      }
      case "purge-cache": {
        if (isOmlxServerRunning()) {
          store.addInfoMessage(
            "purge-cache refused: omlx-server is running.\nStop the oMLX server first, then run /purge-cache again. Models, settings, logs and usage stats are never touched.",
          )
          return
        }
        const result = purgeOmlxSessionCache()
        if (result.refused) {
          store.addInfoMessage("purge-cache refused: could not confirm omlx-server is stopped.")
          return
        }
        const mb = (result.freedBytes / 1024 / 1024).toFixed(1)
        store.addInfoMessage(
          result.removed.length === 0
            ? "purge-cache: nothing to remove."
            : `purge-cache: removed ${result.removed.length} directorie(s), freed ${mb} MB of session KV-cache.\noMLX rebuilds it as needed; models, settings, logs and usage stats were untouched.`,
        )
        return
      }
      case "privacy-check": {
        if (busy()) {
          store.showToast("busy — try /privacy-check when idle", "warn")
          return
        }
        void runPrivacyCheck()
        return
      }
      case "exit":
        secureExit(renderer, 0)
        return
      case "mcp": {
        if (store.mcpServers().length === 0) {
          store.addInfoMessage(
            "mcp: no servers configured.\nAdd stdio servers under mcp.servers in ~/.config/rokaru/config.json.",
          )
          return
        }
        store.setMcpPanelIndex(0)
        store.setMcpPanel(true)
        return
      }
      case "skills": {
        if (store.skillList().length === 0) {
          store.addInfoMessage(
            "skills: none found.\nAdd a SKILL.md under ~/.config/rokaru/skills/<name>/ or .rokaru/skills/<name>/.",
          )
          return
        }
        store.setSkillPanelIndex(0)
        store.setSkillPanel(true)
        return
      }
      case "themes": {
        const names = themeNames()
        const active = names.indexOf(activeThemeName())
        store.setThemeIndex(active >= 0 ? active : 0)
        store.setThemeCustom(false)
        store.setThemePanel(true)
        return
      }
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
          store.showToast(`image: ${(err as Error).message}`, "error")
        }
        return
      }
      case "clear":
      case "new":
        newConversation("conversation cleared")
        return
      case "compact": {
        if (busy()) {
          store.showToast("busy — try /compact when idle", "warn")
          return
        }
        const controller = new AbortController()
        void compactHistory(options(controller.signal))
        return
      }
    }
  }

  const paletteActions = (): (PaletteAction & { run: () => void })[] => [
    ...COMMANDS.map((command) => ({
      label: `/${command.name}`,
      description: command.description,
      run: () => {
        store.setPalette(false)
        if (command.name === "model") {
          store.setSwitchingModel(true)
        } else if (command.name === "image" || command.name === "find") {
          store.setInputPrefill(`/${command.name} `)
        } else {
          runCommand(`/${command.name}`)
        }
      },
    })),
    {
      label: store.mode() === "plan" ? "switch to build mode" : "switch to plan mode",
      description: "toggle read-only planning",
      run: () => {
        store.setPalette(false)
        store.setMode(store.mode() === "plan" ? "build" : "plan")
      },
    },
    {
      label: "toggle reasoning",
      description: "show/hide all thinking",
      run: () => {
        store.setPalette(false)
        store.setShowReasoning(!store.showReasoning())
      },
    },
    {
      label: "quit",
      description: "exit rokaru (wipes the session)",
      run: () => secureExit(renderer, 130),
    },
  ]

  const visiblePaletteActions = () => filterPaletteActions(paletteActions(), store.paletteQuery())

  // MCP servers are toggled here, per session only (never autostarted).
  const toggleMcp = async (index: number) => {
    const entry = store.mcpServers()[index]
    if (!entry) return
    const serverConfig = config.mcp?.servers?.[entry.name]
    if (!serverConfig) return
    if (entry.status === "connected") {
      disconnectServer(entry.name)
      unregisterDynamicTools(mcpToolNames.get(entry.name) ?? [])
      mcpToolNames.delete(entry.name)
      updateMcpStatus(entry.name, { status: "disabled", tools: 0, error: undefined })
      store.showToast(`mcp ${entry.name}: off`, "info")
      return
    }
    updateMcpStatus(entry.name, { status: "connecting", tools: 0, error: undefined })
    const result = await connectServer(entry.name, serverConfig, {
      trimDescriptions: config.mcp.trimDescriptions === true,
    })
    if (result.error) {
      updateMcpStatus(entry.name, { status: "error", tools: 0, error: result.error })
      store.showToast(`mcp ${entry.name}: ${result.error}`, "error")
    } else {
      registerDynamicTools(result.tools)
      mcpToolNames.set(entry.name, result.toolNames)
      updateMcpStatus(entry.name, { status: "connected", tools: result.tools.length })
      store.showToast(`mcp ${entry.name}: ${result.tools.length} tools`)
    }
  }

  // Theme editor actions (keyboard-driven from the /themes panel).
  const applyTheme = (name: string) => {
    if (setCurrentTheme(name)) store.showToast(`theme · ${name}`)
    store.setThemePanel(false)
  }

  const startCustomTheme = () => {
    store.setThemeDraft({ ...getTheme() })
    store.setThemeCustomRole(0)
    store.setThemeCustom(true)
  }

  const cancelCustomTheme = () => {
    store.setThemeCustom(false)
    store.setThemeDraft(undefined)
  }

  const cycleThemeRole = (delta: number) => {
    const draft = store.themeDraft()
    if (!draft) return
    const role = THEME_ROLES[store.themeCustomRole()]
    const at = THEME_COLOURS.indexOf(draft[role])
    const next =
      at === -1 ? (delta > 0 ? 0 : THEME_COLOURS.length - 1) : (at + delta + THEME_COLOURS.length) % THEME_COLOURS.length
    store.setThemeDraft({ ...draft, [role]: THEME_COLOURS[next] })
  }

  const saveCustomTheme = () => {
    const draft = store.themeDraft()
    if (!draft) return
    let name = "custom"
    let n = 2
    while (THEMES[name]) name = `custom-${n++}`
    if (!addCustomTheme(name, draft)) {
      store.showToast("could not create theme", "error")
      return
    }
    setCurrentTheme(name)
    cancelCustomTheme()
    store.setThemePanel(false)
    store.showToast(`theme · ${name} (created)`)
  }

  const send = (text: string) => {
    const attachments = store.pendingImages()
    store.clearPendingImages()
    store.clearFindNav()
    scrollTranscriptToBottom()
    sentHistory.push(text)
    historyIndex = sentHistory.length
    navigating = false
    lastRecalled = ""
    controller = new AbortController()
    void runTurn({ ...options(controller.signal), attachments }, text).finally(() => {
      controller = undefined
      const category = learning.lastCategory()
      if (category && !suggestedCategories.has(category)) {
        const pick = learning.suggestion(category)
        if (pick && pick.model !== store.model()) {
          suggestedCategories.add(category)
          store.showToast(`tune: ${pick.model} scores better for ${learning.CATEGORY_LABELS[category]} · /tune`, "info")
        }
      }
      if (queued !== undefined) {
        const next = queued
        queued = undefined
        queueMicrotask(() => submit(next))
      }
    })
  }

  const submit = (text: string) => {
    const typing = store.questionTyping()
    const pendingQuestion = store.question()
    if (typing && pendingQuestion) {
      const stash = store.pastedText()
      const answer = (text + (stash ? `\n${stash}` : "")).trim()
      if (answer.length === 0) return
      inputHandle?.clear()
      store.clearPastedText()
      store.answerQuestion({ kind: "custom", text: answer })
      return
    }
    const stash = store.pastedText()
    const full = (text + (stash ? `\n${stash}` : "")).trim()
    store.clearPastedText()
    if (busy()) {
      queued = full
      store.showToast("queued — will send when the model is free", "info")
      return
    }
    if (full.startsWith("/")) {
      runCommand(full)
      return
    }
    send(full)
  }

  const recall = (delta: number) => {
    if (!inputHandle || sentHistory.length === 0) return
    historyIndex = Math.max(0, Math.min(sentHistory.length, historyIndex + delta))
    navigating = true
    const text = historyIndex >= sentHistory.length ? "" : sentHistory[historyIndex]
    lastRecalled = text
    inputHandle.setText(text)
  }

  const onContentChange = (value: string) => {
    // A programmatic recall sets `lastRecalled`; anything else is the user
    // typing, which resets the history cursor.
    if (value !== lastRecalled) {
      historyIndex = sentHistory.length
      navigating = false
      lastRecalled = ""
    }
    store.setInputValue(value)
    store.setMenuIndex(0)
    store.setMentionIndex(0)
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

    if (key.ctrl && key.name === "y") {
      key.preventDefault()
      const last = [...store.messages()].reverse().find((m) => m.role === "assistant")
      const committed = last
        ? last.parts
            .filter((p) => p.kind === "text")
            .map((p) => (p as { text: string }).text)
            .join("\n")
        : ""
      const buffer = store.streamBuffer()
      const tail = buffer && last && buffer.messageId === last.id && buffer.kind === "text" ? buffer.text : ""
      const text = [committed, tail].filter((s) => s.length > 0).join("\n").trim()
      if (text.length > 0) {
        copyToClipboard(text)
        store.showToast("copied last response")
      } else {
        store.showToast("nothing to copy", "info")
      }
      return
    }

    if (key.ctrl && key.name === "p") {
      key.preventDefault()
      if (store.palette()) {
        store.setPalette(false)
        store.setPaletteQuery("")
      } else {
        store.setPaletteIndex(0)
        store.setPaletteQuery("")
        store.setPalette(true)
      }
      return
    }

    if (store.palette()) {
      if (key.ctrl || key.meta) return
      const actions = visiblePaletteActions()
      if (key.name === "escape") {
        key.preventDefault()
        store.setPalette(false)
        store.setPaletteQuery("")
      } else if (key.name === "up") {
        key.preventDefault()
        store.setPaletteIndex(Math.max(0, store.paletteIndex() - 1))
      } else if (key.name === "down") {
        key.preventDefault()
        store.setPaletteIndex(Math.min(Math.max(0, actions.length - 1), store.paletteIndex() + 1))
      } else if (key.name === "return" || key.name === "enter") {
        key.preventDefault()
        actions[store.paletteIndex()]?.run()
      } else if (key.name === "backspace" || key.name === "delete") {
        key.preventDefault()
        store.setPaletteQuery(store.paletteQuery().slice(0, -1))
        store.setPaletteIndex(0)
      } else if (key.name === "space" || (key.name !== undefined && key.name.length === 1)) {
        key.preventDefault()
        store.setPaletteQuery(store.paletteQuery() + (key.name === "space" ? " " : (key.name ?? "")))
        store.setPaletteIndex(0)
      }
      return
    }

    if (store.mcpPanel()) {
      const list = store.mcpServers()
      if (key.name === "escape") {
        key.preventDefault()
        store.setMcpPanel(false)
      } else if (key.name === "up") {
        key.preventDefault()
        store.setMcpPanelIndex(Math.max(0, store.mcpPanelIndex() - 1))
      } else if (key.name === "down") {
        key.preventDefault()
        store.setMcpPanelIndex(Math.min(Math.max(0, list.length - 1), store.mcpPanelIndex() + 1))
      } else if (key.name === "return" || key.name === "enter" || key.name === "space") {
        key.preventDefault()
        void toggleMcp(store.mcpPanelIndex())
      }
      return
    }

    if (store.skillPanel()) {
      const list = store.skillList()
      if (key.name === "escape") {
        key.preventDefault()
        store.setSkillPanel(false)
      } else if (key.name === "up") {
        key.preventDefault()
        store.setSkillPanelIndex(Math.max(0, store.skillPanelIndex() - 1))
      } else if (key.name === "down") {
        key.preventDefault()
        store.setSkillPanelIndex(Math.min(Math.max(0, list.length - 1), store.skillPanelIndex() + 1))
      }
      return
    }

    if (store.themePanel()) {
      if (store.themeCustom()) {
        if (key.name === "escape") {
          key.preventDefault()
          cancelCustomTheme()
        } else if (key.name === "up") {
          key.preventDefault()
          store.setThemeCustomRole(Math.max(0, store.themeCustomRole() - 1))
        } else if (key.name === "down") {
          key.preventDefault()
          store.setThemeCustomRole(Math.min(THEME_ROLES.length - 1, store.themeCustomRole() + 1))
        } else if (key.name === "left") {
          key.preventDefault()
          cycleThemeRole(-1)
        } else if (key.name === "right") {
          key.preventDefault()
          cycleThemeRole(1)
        } else if (key.name === "return" || key.name === "enter") {
          key.preventDefault()
          saveCustomTheme()
        }
      } else {
        const names = themeNames()
        const rows = names.length + 1
        if (key.name === "escape") {
          key.preventDefault()
          store.setThemePanel(false)
        } else if (key.name === "up") {
          key.preventDefault()
          store.setThemeIndex(Math.max(0, store.themeIndex() - 1))
        } else if (key.name === "down") {
          key.preventDefault()
          store.setThemeIndex(Math.min(rows - 1, store.themeIndex() + 1))
        } else if (key.name === "return" || key.name === "enter") {
          key.preventDefault()
          const index = store.themeIndex()
          if (index >= names.length) startCustomTheme()
          else applyTheme(names[index])
        }
      }
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
      } else if (key.name === "a" && key.shift) {
        key.preventDefault()
        store.answerPermission("all")
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

    const pendingQuestion = store.question()
    if (pendingQuestion) {
      if (store.questionTyping()) {
        if (key.name === "escape") {
          key.preventDefault()
          store.setQuestionTyping(false)
        }
        return
      }
      if (key.name === "up") {
        key.preventDefault()
        store.moveQuestionIndex(-1)
      } else if (key.name === "down") {
        key.preventDefault()
        store.moveQuestionIndex(1)
      } else if (key.name === "return" || key.name === "enter") {
        key.preventDefault()
        store.selectQuestionRow(store.questionIndex())
      } else if (key.name === "escape") {
        key.preventDefault()
        store.answerQuestion({ kind: "dismissed" })
      } else if (/^[1-9]$/.test(key.name ?? "")) {
        const row = Number(key.name) - 1
        if (row < store.questionRowCount()) {
          key.preventDefault()
          store.selectQuestionRow(row)
        }
      }
      return
    }

    const nav = store.findNav()
    if (nav && !key.ctrl && !key.meta) {
      if (key.name === "escape") {
        key.preventDefault()
        store.clearFindNav()
        scrollTranscriptToBottom()
      } else if (key.name === "n") {
        key.preventDefault()
        stepFindNav(1)
      } else if (key.name === "p") {
        key.preventDefault()
        stepFindNav(-1)
      } else {
        store.clearFindNav()
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
      if (
        (key.name === "backspace" || key.name === "delete") &&
        store.pastedText().length > 0 &&
        store.inputValue() === ""
      ) {
        key.preventDefault()
        store.clearPastedText()
        return
      }
      const mention = mentionMatches(store.inputValue(), workspace)
      if (mention) {
        if (key.name === "up") {
          key.preventDefault()
          store.setMentionIndex(Math.max(0, store.mentionIndex() - 1))
          return
        }
        if (key.name === "down") {
          key.preventDefault()
          store.setMentionIndex(Math.min(mention.files.length - 1, store.mentionIndex() + 1))
          return
        }
        if (key.name === "tab") {
          key.preventDefault()
          const chosen = mention.files[Math.min(store.mentionIndex(), mention.files.length - 1)]
          inputHandle?.setText(applyMention(store.inputValue(), mention, chosen))
          store.setMentionIndex(0)
          return
        }
      }
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
          inputHandle?.setText(`/${chosen.name} `)
          store.setMenuIndex(0)
          return
        }
      }
      // Tab switches plan/build mode (unless the command menu is open above).
      if (key.name === "tab") {
        key.preventDefault()
        const next = store.mode() === "plan" ? "build" : "plan"
        store.setMode(next)
        store.showToast(`mode: ${next}`, "info")
        return
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
    setPhase("ready")
  }

  const switchTo = (model: ModelInfo) => {
    applyModel(model)
    store.setSwitchingModel(false)
  }

  return (
    <box width="100%" height="100%" backgroundColor={getTheme().background}>
      <Show
        when={phase() === "ready"}
        fallback={<Startup phase={phase()} message={loadError()} models={store.models()} onSelect={chooseModel} />}
      >
      <Show
        when={store.switchingModel()}
        fallback={
          <Show
            when={store.palette()}
            fallback={
              <Show
                when={store.mcpPanel()}
                fallback={
                  <Show
                    when={store.skillPanel()}
                    fallback={
                      <Show
                        when={store.themePanel()}
                        fallback={
                          <ChatView
                            onSubmit={submit}
                            inputHeight={config.inputHeight}
                            onReady={(handle) => (inputHandle = handle)}
                            onContentChange={onContentChange}
                          />
                        }
                      >
                        <ThemePanel />
                      </Show>
                    }
                  >
                    <SkillsPanel skills={store.skillList()} />
                  </Show>
                }
              >
                <McpPanel servers={store.mcpServers()} />
              </Show>
            }
          >
            <CommandPalette
              actions={visiblePaletteActions()}
              query={store.paletteQuery()}
              onPick={(index) => visiblePaletteActions()[index]?.run()}
            />
          </Show>
        }
      >
        <SwitchModel baseURL={config.baseURL} apiKey={resolveApiKey()} onSelect={switchTo} />
      </Show>
      </Show>
    </box>
  )
}

export function Startup(props: {
  phase: Phase
  message: string
  models: ModelInfo[]
  onSelect: (model: ModelInfo) => void
}) {
  // Size the rain's clear rectangle to the centred content so it can't overlap
  // the logo or the model list as the list grows.
  const logo = loadLogo()
  const logoWidth = Math.max(0, ...logo.map((row) => row.reduce((sum, span) => sum + span.text.length, 0)))
  const contentRows = () => startupContentRows(props.models.length, logo.length, props.phase === "pick")
  const contentCols = () => startupContentCols(logoWidth)
  return (
    <box width="100%" height="100%">
      <StartupBackground clearRows={contentRows()} clearCols={contentCols()} />
      <box
        position="absolute"
        top={0}
        left={0}
        width="100%"
        height="100%"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
      >
        <box
          flexDirection="column"
          alignItems="center"
          paddingLeft={3}
          paddingRight={3}
          paddingTop={1}
          paddingBottom={1}
        >
          <AsciiLogo />
          <text fg={getTheme().dim}>private local harness for oMLX</text>
          <text fg={getTheme().accent}>{`v${VERSION}`}</text>
          <text fg={getTheme().text}>{""}</text>
          <Show when={props.phase === "pick"}>
            <ModelPicker models={props.models} onSelect={props.onSelect} />
          </Show>
          <Show when={props.phase === "loading"}>
            <text fg={getTheme().dim}>contacting oMLX…</text>
          </Show>
          <Show when={props.phase === "error"}>
            <text fg={getTheme().bad}>{props.message}</text>
          </Show>
          <text fg={getTheme().text}>{""}</text>
          <text fg={getTheme().dim}>{`workspace · ${store.workspace() || "?"}`}</text>
          <text fg={getTheme().dim}>ctrl+c to quit</text>
        </box>
      </box>
    </box>
  )
}
