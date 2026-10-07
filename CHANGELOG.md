# Changelog

All notable changes to rokaru. Version is shown on the start screen and in the
sidebar.

## [0.7.3] - 2026-10-07

### Added

- **`/privacy-check` command.** Sends one canary request through oMLX, then
  scans `~/.omlx` (excluding `models/`) for the token and reports `PASS`/`FAIL`
  alongside the on-disk state (`hot_cache_only`, `usage_history`,
  `usage.sqlite3`, `stats.json`, `response-state`). Confirms no readable trace
  of a session is persisted.

## [0.7.2] - 2026-10-07

### Added

- **`/purge-cache` command.** Deletes oMLX session KV-cache shards, duplicated
  sidecars and per-session snapshots (`~/.omlx/cache`). Refuses while
  `omlx-server` is running and never touches models, settings, logs, usage
  stats or vision features.

## [0.7.1] - 2026-10-07

### Changed

- **`/find` jumps to hits.** Matches step through the transcript in place
  (`n` next, `p` prev, `esc` back to bottom) instead of printing as text.
  Typing or sending a message exits navigation and restores follow mode.
- **Palette tidy.** The duplicate `switch model` row is gone — `/model` opens
  the picker directly.

### Fixed

- `ctrl+y` separates committed text and the live tail with a newline.

## [0.7.0] - 2026-10-07

### Changed

- **Themes paint the whole terminal.** Every palette has a `background` colour
  now, and the app fills the full terminal with it — chat, overlays and the
  startup screen — so dark themes no longer sit on plain terminal black. The
  custom-theme editor exposes it as the `terminal background` role.
- **Original theme names.** The built-ins are renamed: `slate`→`onyx`
  (still the default), `github`→`graphite`, `nord`→`glacier`,
  `dracula`→`nocturne`, `solarized`→`lagoon`, `rosepine`→`plum`.

## [0.6.3] - 2026-10-07

### Fixed

- **`question` custom answers.** Picking "type your own answer" did nothing: the
  code touched the previous (already destroyed) input box, which threw and never
  switched into typing mode. The prompt now flips state first and lets the fresh
  input take focus. Palette `image`/`find` prefill had the same latent fault and
  now lands via a deferred prefill instead.

## [0.6.2] - 2026-10-07

### Added

- **`question` tool.** When the model needs a decision it takes over the prompt
  with a pick list (`↑↓`/`1-6` to choose, `enter` to answer, `esc` dismisses,
  or type your own answer) instead of asking in plain text.

### Changed

- **Prompt panel overhaul.** The input box starts compact and grows to 10
  typing rows as you type; permission prompts render inside the prompt panel
  itself; the sidebar header shows `rokaru vX` and the old bottom version line
  is gone.
- **`ctrl+p` searches.** Typing filters the palette and `enter` jumps straight
  to the action (e.g. the model picker) instead of inserting `/model`.
- **Pasted text collapses.** Pastes longer than a few lines — or anything taller
  than the box — become a `Pasted N lines` row inside the prompt and send with
  your message (`⌫` on an empty box drops them).

## [0.6.0] - 2026-10-07

### Changed

- **Smoother streaming.** Incoming tokens now collect in a small live buffer and
  are folded into the transcript only at segment boundaries (end of an answer, a
  tool call, or end of turn), instead of rebuilding the whole message list on
  every flush. Long conversations stay light and replies no longer redraw from
  scratch while they stream. A reply cut short with `esc` still commits the text
  received so far, and `ctrl+y` copies the in-progress tail.

## [0.5.0] - 2026-10-07

### Added

- **Animated start-screen background** — a dim, slow-drifting field of glyphs
  fills the space around the logo/model picker on the terminal's own background
  (no separate panel), kept clear of the centre so text stays readable; stops
  once the session starts. The glyphs are **tinted with the logo's own gradient
  palette**, which changes each launch.
- **Session-screen animations** (timeline + easing): running tools show a braille
  **spinner**, new messages **fade in**, and the sidebar context bar **animates**
  to its new value.
- **Full-width footer status line** — mode · context % · git branch · `ctrl+p`,
  plus the activity meter and `esc interrupt` while working.
- **Subagent `task` tool** — delegate a read-only investigation to a subagent
  with its own context; it returns a concise answer.
- **`AGENTS.md` auto-load** — a workspace `AGENTS.md` is injected into the system
  prompt.
- **Post-edit diagnostics** — after the model edits files, rokaru runs the
  project check (a detected `typecheck` script or local `tsc`, or
  `diagnostics.command`) once and feeds failures back for fixing.
- **`read_file` pagination** via `offset`/`limit`.
- **`ctrl+y`** copies the last agent response.
- **Code-block syntax highlighting** and a **blockquote bar** (custom markdown
  renderer replacing the library one).

### Changed

- Tool results are capped (`tools.maxResultChars`) and the agent caps tool rounds
  per turn (`tools.maxRounds`).
- **Readability pass on replies**: sections/paragraphs/list-blocks are now spaced
  out, markdown **tables are rendered** (aligned columns) instead of raw pipes,
  blockquotes get a bar, and inline `*italics*`/`**bold**` markers are stripped
  and coloured.
- **Line numbers** now show for code: fenced code blocks, `edit_file` diffs (old/
  new gutters) and `write_file` previews.
- The **footer** is a full-width two-row bar (separator + a filled status row),
  and the sidebar **Todo** panel sits below **MCP**.

### Fixed

- Tool-round cap default raised from 12 to **100** (`tools.maxRounds`; `0` =
  unlimited) — the low cap was cutting long tasks short.
- The oMLX **prefill memory-guard** rejection is now treated as context
  overflow: rokaru auto-compacts (keeping the current request) and retries,
  instead of erroring out. HTTP errors now show the server's message rather than
  a wall of JSON.
- Context overflow now auto-compacts (preserving the current request) and retries.
- MCP tool calls abort on `esc`.
- Turns longer than 5s ring the terminal bell (`notify`).
- Prompt history: `↑`/`↓` now cycle through **all** prior prompts (the textarea's
  async content-change was resetting the history cursor after the first recall).
- A tool panel turning **running** crashed rendering with
  `TextNodeRenderable only accepts strings, …` — the spinner was a `<text>` nested
  inside the header `<text>`. The header is now a row of sibling text nodes.
- Replies **flickered while streaming**: the message list keyed rows by object
  identity, so every token remounted the row and replayed its fade-in. Rows now
  update in place, so the fade runs once per message.

## [0.4.0] - 2026-10-06

### Added

- **Tool panels** show a per-category icon and colour (read blue, write amber,
  `$` bash green, web/MCP purple) and each call's **duration**; click a panel to
  expand it.
- **Permission previews** — the prompt shows what will run: a `$` code block for
  `bash`, a red/green diff for `edit_file`, content for `write_file`, else a
  summary line.
- **Richer sidebar** — two-tone context bar (cached vs new tokens) with a
  **cache-hit %**, colour-graded TTFT/TPS, turn **elapsed** time, and the current
  **git branch** (with `*` when dirty).
- **Empty-state hint** before the first message.

### Changed

- **User messages** render as a tinted block, with a separator between turns; the
  streaming caret now animates.
- **Toasts are typed** (success / info / warn / error) with matching colour/icon.
- **`/themes`** panel shows a live preview of the highlighted palette.

### Fixed

- User-message blocks had no vertical padding, so the text hugged the tinted
  box; they now have a row of padding above and below.

### Deferred

- Code-block syntax highlighting (the bundled tree-sitter client isn't in
  `@opentui/core`'s public exports) and a blockquote bar.

## [0.3.0] - 2026-10-06

### Added

- **Plan / build modes.** `/plan` is read-only (no writing or exec tools are
  offered); `/build` restores full editing. Shown in the sidebar.
- **`todo_write` tool** — the model keeps a task list, rendered as a checklist.
- **Ctrl+P command palette** and **`/find <text>`** transcript search.
- **`/undo`** — reverts the model's last file edit from in-memory snapshots.
- **Secret redaction** — credential shapes (AWS/GitHub/OpenAI keys, JWTs,
  private keys, `password=…`, URL credentials) are masked in tool output.
- **Bash permission patterns** — "always allow" remembers the leading command
  word (e.g. `git`) rather than the whole tool.
- **MCP client (local stdio).** Declare servers under `mcp.servers`. They start
  **disabled on every launch** and are opt-in per session, so a fresh start has
  no extra tool schemas. `/mcp` opens an interactive panel (`↑`/`↓`, `enter` to
  toggle, `esc`) with per-server status (connected / disabled / error + tool
  count), mirrored in the sidebar **MCP** panel. Read-only tools
  (`readOnlyHint`) run automatically, the rest ask permission; servers are shut
  down on exit and toggling isn't persisted.
- **`tab`** switches plan/build; **`/exit`** quits (alias `/quit`).
- **`/themes`** (alias `/theme`) — live colour-theme picker with six built-in
  palettes (slate, github, nord, dracula, solarized, rosepine) and a keyboard
  custom-theme editor. Session-only, like the rest of rokaru.

### Fixed

- **Web search works again.** DuckDuckGo (and then Bing) began serving
  anti-bot challenge pages, so `web_search` returns results via a keyless
  fallback chain — **Brave → Bing → DuckDuckGo** — with parsers for each and
  Bing/DDG redirect unwrapping. `searchURL` (with `{query}`) overrides the
  primary engine.

### Changed

- Prompt panel: removed the `prompt` title, added a `Build/Plan · <model>`
  footer, and put a coloured left gutter line that reflects the mode.
- Clearer colours: **build = amber**, **plan = light blue**, the progress meter
  is **purple**, and mode (identity) is kept separate from activity.
- Sidebar trimmed to Session Context and Model Speed; the mode/model line lives
  in the prompt footer, and the toast appears inside the assistant pane.
- More readable replies: body text softened from pure white, headings and
  emphasis in amber, inline code green, and numbers/dates/times/measurements
  auto-highlighted. A **Todo** panel now shows in the sidebar while the agent
  works through a task list, and the transcript labels replies **agent**.

## [0.2.0] - 2026-10-06

Substantial feature release: images, read-only web, a richer TUI, commands, and
several privacy/reliability hardening passes.

### Added

- **Image / vision support.** `/image <path>` attaches an image to your next
  message; a `view_image` tool lets the model open image files itself. Images are
  sent to oMLX as `image_url` data URLs and stay local.
- **Read-only web access** (off by default). `web_search` and `web_fetch` tools.
  Guards: `GET` only (plus a `POST` of the query to your search engine), exact
  allowlist so `web_fetch` only reads URLs returned by a `web_search`, no private
  / loopback / link-local / cloud-metadata addresses, http/https only, no
  credentials in URLs, redirects re-validated, and byte/time caps.
- **Segmented tool panels.** Each tool call renders in its own bordered panel
  with a human header (`→ Read`, `← Edit`, `$ bash`, …) and a red/green diff for
  edits. Output collapses with `ctrl+o`.
- **Clickable thinking.** Reasoning shows as a yellow `Thought: 4.8s` line,
  collapsed by default and click to expand; `ctrl+r` toggles all.
- **Progress / context bar** under the prompt. While working: an animated pulse,
  the phase, and `esc interrupt`. While idle: your folder and active model.
- **Commands.** `/model [name]`, `/image <path>`, `/compact`, `/clear`, `/new`,
  `/help`, with a `/` menu (tab completes) and prefix resolution.
- **Input UX.** Queue a prompt while the model is working, `↑`/`↓` to recall
  earlier prompts, `ctrl+o` to expand tool output.
- **Model picker and `/model` switching**, re-fetching the model list from oMLX.
- **Three-way permissions.** `allow once` / `always allow (this session)` /
  `deny`, with a session-scoped allowlist (RAM only, wiped on exit).
- **Markdown rendering** of assistant replies (headings, lists, code, tables).
- **Protected paths.** Tools and the sandbox refuse to read `~/.ssh`, `~/.aws`,
  keychains, browser data, oMLX config and other secret locations.
- **Version display** on the start screen and in the sidebar.
- **Exit hygiene.** Terminal screen and scrollback are cleared on exit and core
  dumps are disabled in the launcher.

### Changed

- Prompt box: left padding and a coloured accent line (blue idle, yellow busy),
  like opencode; fixed height is configurable via `inputHeight`.
- Sidebar moved to the right; panel content no longer overlaps on short screens.
- Startup screen is centred and shows the logo, rendered with a fresh random
  gradient each launch via `cli-ascii-logo … --random`.
- Tagline is now "private local harness for oMLX".
- System prompt no longer hard-asserts "no network"; the network capability is
  described dynamically based on whether web access is enabled.

### Fixed

- Model picker: the `↑` arrow was swallowed by the prompt-history handler when
  the input was empty, so you couldn't move back up from the bottom model.
- `esc interrupt` no longer clips at 80 columns (responsive bar width, shorter
  status labels).

### Performance

- Streaming output is throttled (~60 ms flush) instead of rebuilding the message
  list on every token.

### Reliability

- Retry with backoff when oMLX drops before any output.
- Cheap repair of malformed tool-call JSON from local models.
- Independent read-only tool calls run in parallel.
- Context gauge warns at 85% and suggests `/compact`.

## [0.1.0] - 2026-10-06

Initial release: private, ephemeral agentic TUI for a local oMLX server with
streaming chat, measured TTFT/TPS, a live context gauge, a read/write/edit/bash
toolset, a sandboxed shell, permissions, RAM-only sessions and loopback-only
networking.
