<p align="center">
  <img src="assets/rokaru.png" alt="rokaru" width="420">
</p>

<h3 align="center">A private, local AI coding agent for <a href="https://github.com/jundot/omlx">oMLX</a> on Apple Silicon.</h3>

<p align="center">
  <img alt="platform" src="https://img.shields.io/badge/platform-macOS-black?style=flat-square">
  <img alt="runtime" src="https://img.shields.io/badge/runtime-Bun-f472b6?style=flat-square">
  <img alt="serves" src="https://img.shields.io/badge/serves-oMLX-7c5cff?style=flat-square">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-3b82f6?style=flat-square">
</p>

rokaru is a privacy-first TUI that turns a local model served by **oMLX** into a
coding agent. It reads and edits files, runs
commands and plans work, while keeping everything on your machine and out of
long-term storage.

## Why rokaru

- **Fully local.** Only supports local models via oMLX. The only path to the internet is the optional, read-only web tools.
- **Optimised for oMLX.** Tuned for oMLX's streaming protocol, prefix caching, and memory guard behaviour.
- **Self tuning.** Keeps a private, content-free scorecard of which model and settings work on your machine, suggesting better choices over your session.
- **RAM-only sessions.** No transcript, history or log is written to disk; on
  exit (`ctrl+c`, `SIGTERM`, crash) buffers are wiped, so there is nothing to
  recover.
- **Sandboxed tools.** Shell commands run with **all network denied** and writes
  confined to your workspace; sensitive paths are refused outright.
- **Session Wipe.** When you close rokaru your session data is wiped and is irretrievable (session data may be still be retrievable via olmx's kv cache / other)

## Quick start

**Requirements:** macOS on Apple Silicon, [Bun](https://bun.sh), and an
[oMLX](https://github.com/jundot/omlx) server already running with a model loaded.

### Let your agent install it

Paste this into your coding agent (Claude Code, opencode, Cursor, …):

```text
Install rokaru from https://github.com/ashcdev-hub/rokaru.git:
- clone it to ~/dev/rokaru
- symlink ~/dev/rokaru/bin/rokaru into a directory on my PATH (e.g. /usr/local/bin)
- check that Bun and an oMLX server (with a model loaded) are available
- run `rokaru` once to confirm it launches
```

### Or install it manually

```sh
git clone https://github.com/ashcdev-hub/rokaru.git ~/dev/rokaru
ln -sfn ~/dev/rokaru/bin/rokaru /usr/local/bin/rokaru
```

Then run it from any project directory (that directory becomes the workspace):

```sh
cd ~/some/project
rokaru
```

## Modes

| Mode | What the model may do |
| --- | --- |
| **build** (default) | Read, search, edit files and run commands. |
| **plan** | Read-only; writing and exec tools aren't even offered. |

Switch with `/plan` and `/build`, or the **Tab** key.

## Commands

Type `/` for a menu (**Tab** completes) or **Ctrl+P** for the palette.

| Command | Description |
| --- | --- |
| `/model [name]` | Switch model (the list is re-fetched from oMLX). |
| `/plan` · `/build` | Toggle read-only planning / full editing. |
| `/image <path>` | Attach an image (png/jpg/jpeg/gif/webp/bmp) to your next message. |
| `/compact` | Summarise the conversation to reclaim context. |
| `/undo [list]` | Revert the model's last file edit, or list the undo stack. |
| `/redo` | Re-apply the last undone edit. |
| `/changes` | Review the files changed this session and revert one. |
| `/retry` | Re-run your last message and regenerate the reply. |
| `/tune` | Show the self-tuning scoreboard and a recommendation. |
| `/good` · `/bad` | Label the last turn to train tuning. |
| `/find <text>` | Jump through conversation matches (`n` next, `p` prev). |
| `/clear` · `/new` | Start over. |
| `/mcp` | Enable/disable MCP servers (interactive panel). |
| `/skills` | List available skills (interactive panel). |
| `/purge-cache` | Delete oMLX session KV-cache (oMLX server must be stopped). |
| `/privacy-check` | Send a canary request and scan oMLX for any on-disk trace. |
| `/themes` | Switch colour theme (alias `/theme`). |
| `/help` | List commands. |
| `/exit` | Quit (alias `/quit`). |

A prompt sent while the model is working is queued and sent when it's free. Your
draft is kept if you open the palette, MCP, theme or model panel, and restored
when you come back.

Keyboard: `enter` send · `shift+enter` newline · `tab` plan/build · `esc`
interrupt (a menu offers **stop now** or **finish the current tool, then
stop**) · `pgup`/`pgdn` and `shift+↑`/`shift+↓` scroll the transcript ·
`home`/`end` jump to top/bottom · `ctrl+r` reasoning · `ctrl+o` expand tools ·
`ctrl+y` copy reply · `ctrl+b` sidebar · `ctrl+x` cancel the running tool ·
`ctrl+p` palette. Click a `you`/`agent` label or a fenced code block to copy it.

## Privacy & security

- **RAM-only sessions.** No transcript, history or log is written to disk. On
  exit (`ctrl+c`, `SIGTERM`, crash) buffers are wiped; there's nothing to recover.
- **Local by default.** The oMLX connection is checked against `127.0.0.1` / `::1`
  / `localhost`; anything else is refused. Proxy env vars are stripped.
- **Sandboxed tools.** `bash` runs under `sandbox-exec` with all network denied
  and writes confined to the workspace + temp; `write_file`, `edit_file` and
  `replace_in_files` are workspace-confined too.
- **Protected paths.** Tools and the sandbox refuse to read `~/.ssh`, `~/.aws`,
  keychains, browser data, the oMLX config and other secret locations.
- **Secrets.** The API key comes from env or the macOS Keychain, never written to
  disk. Config dir `~/.config/rokaru` is `0700`, file `0600`.
- **No telemetry.** On exit the screen and scrollback are cleared and core dumps
  are disabled.

Caveats: your prompts still pass through oMLX, which keeps its own KV cache and
usage DB; rokaru doesn't touch those. Run **`/privacy-check`** to confirm what
oMLX actually left on disk. And the sandbox blocks network and writes, but not
**reads**; don't point it at a box full of secrets.

## Self-tuning

rokaru keeps a private, content-free scorecard of which model and settings
actually work, for each kind of task, on your machine, and suggests better
choices over time. It is on by default and never changes anything without you.

- It categorises each turn (answering a question, fixing tests, refactoring,
  adding a feature, docs, other) and records only aggregate counts per model and
  settings. Your prompts, code and replies are never stored.
- It infers success from turn errors, the post-edit check, and `/undo`; label a
  turn yourself with `/good` or `/bad`.
- It only suggests. After a turn it may hint that another model scores higher,
  and `/tune` shows the scoreboard plus a recommendation for your last task.
- The scorecard is in memory by default, so "nothing on disk" still holds. Set
  `learning.persist: true` to keep it across restarts, in
  `~/.config/rokaru/learning.json` (counts only, mode `0600`). `learning.minRuns`
  (default 3) is how much evidence is needed before a suggestion.

## Features

### Tools

`read_file`, `list_dir`, `glob`, `grep`, `view_image`, `task`, `todo_write` and
`question` run automatically; `write_file`, `edit_file`, `replace_in_files` and
`bash` ask first. The request appears as a card with a preview box (a `$` block
for `bash`, a diff for edits) and the choices as highlighted rows — **allow
once**, **always allow** (for the rest of the session) or **deny** with
`↑`/`↓` and `enter` (or `y`/`a`/`n`). Tool output is scanned for credential
shapes and masked before it reaches the model.

Type `@` in the prompt to open a floating file card (fuzzy match on the current
query, ignoring `.git`/`node_modules`); **Tab** inserts the path. The `question`
tool is likewise a card: pick a row with `↑↓`/`1-6`, `enter` to answer, `esc` to
dismiss, or choose the last row to type your own answer.

If a turn fails, the error shows as a card with a one-line **suggestion** for
what to try next; click it to copy the message.

Consecutive read-only calls are grouped into one `N read-only calls` row (click to
expand), so a turn that reads many files stays compact. `bash` streams its output
into the panel **while it runs**, and a single running tool can be cancelled with
**`ctrl+x`** without aborting the turn. Every tool panel carries a `▸`/`▾`
expander.

<details>
<summary>Tooling details</summary>

- For `bash`, "always allow" remembers just the leading command word (e.g. `git`).
- `read_file` pages large files with `offset`/`limit`.
- `replace_in_files` rewrites a string across many files at once (literal, or a
  regex with `regex: true`), scopable by glob, and stages an undo snapshot per
  file. It refuses when more than 40 files match.
- `task` delegates a read-only investigation to a subagent with its own context.
- `question` takes over the prompt with a pick list (`↑↓`/`1-6` to choose,
  `enter` to answer, `esc` dismisses, or type your own answer) instead of asking
  in plain text.
- Pastes longer than a few lines collapse to a `Pasted N lines` row and send with
  your message (`⌫` on an empty box drops them); the box grows to `inputHeight`
  rows (default 10).
- Each result is capped by `tools.maxResultChars` (default 24,000) and by
  `tools.maxResultTokens` (default 6,000); rounds per
  turn by `tools.maxRounds` (default 100; `0` = unlimited). Long or single-line
  results are collapsed in the transcript (click to expand).
- **Project context & checks.** A workspace `AGENTS.md` is loaded into the system
  prompt. After edits, rokaru runs the project check once (a detected `typecheck`
  script, a local `tsc`, or `diagnostics.command`) and feeds failures back to be
  fixed. Disable with `diagnostics.enabled: false`.

</details>

### Transcript & navigation

- Scroll with **`pgup`**/**`pgdn`**, **`shift+↑`**/**`shift+↓`** (by line) or
  **`home`**/**`end`**; a scrollbar appears when the transcript overflows.
- Click a **`you`**/**`agent`** label to copy that message, or a fenced **code
  block** to copy it. `ctrl+y` copies the last reply.
- Each reply ends with a subtle `time · duration · tokens` line.
- **`/retry`** re-runs your last message and regenerates the reply. **`/changes`**
  lists every file edited this session with a per-file diff and revert.
- **`esc`** while the model is working opens an interrupt chooser: *stop now*, or
  *finish the current tool, then stop* (the partial reply is kept either way).
- **`/clear`** and **`/new`** ask for confirmation before wiping the session.
- Users and replies carry a coloured header badge and left rail; replayed turns
  are divided by a heavier rule.
- The sidebar collapses with **`ctrl+b`** and hides automatically on narrow
  terminals. The context bar fills green → amber → red as the window fills (blue
  is cached), todos show a completion bar, and a session timer sits at the top.
- While working, the footer shows the phase, tool round, running tools, elapsed
  time, output tokens, live **tokens/sec** and a rough **time-left** estimate.
- **`/find`** highlights matches (on an amber background) in reasoning and tool
  output as you step with `n`/`p`, with the position in the footer.
- **`ctrl+p`** opens the palette, grouped by section with each action's shortcut
  shown.
- The empty transcript offers **clickable quick actions** (commands, themes,
  compact, tune, find, files) so there's no blank page on first run.

### MCP servers (optional)

Rokaru speaks **stdio** MCP only (local child processes); remote `url`-based
servers aren't supported. Servers start **disabled on every launch** and are
opt-in per session, so a fresh start stays fast with no extra tool schemas in the
prompt.

Run **`/mcp`** for an interactive panel: `↑`/`↓` to move, `enter` to toggle,
`esc` to close. Each server's status (connected / disabled / error, with tool
count) shows there and in the sidebar **MCP** panel. Read-only tools (MCP
`readOnlyHint`) run automatically; everything else asks first. Toggling is
session-only, and servers shut down when rokaru exits.

Declare servers under `mcp.servers` in the config:

```json
"mcp": {
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/some/path"]
    }
  }
}
```

### Skills (optional)

A skill is a reusable set of instructions the model can load on demand: a
directory containing a `SKILL.md` (with `name` and `description` in YAML
frontmatter), or a single `.md` file. The directory form is recommended so the
skill can carry supporting files alongside it.

Rokaru looks for skills in:

- `~/.config/rokaru/skills/` — global, available in every project.
- `.rokaru/skills/` — project-local, searched from your workspace up to the git
  root (a nearer skill wins on an id clash).
- any extra directories listed in `skills.sources` (a `~/` path, a relative path
  from the current directory, or an absolute path).

Each source may hold `<name>/SKILL.md` directories and/or loose `*.md` files. A
skill's **id** is its directory name (or the file stem), and that id is what the
model uses to load it.

```text
~/.config/rokaru/skills/git-release/SKILL.md
.rokaru/skills/style.md
```

```markdown
---
name: Git Release
description: Cut a tagged release and update the changelog
---

Steps to follow when asked to release …
```

Run **`/skills`** to see what was found (`↑`/`↓` to move, `esc` to close). A
skill that has a `description` is *invocable*: rokaru advertises it to the model,
which loads it by calling the `skill` tool. A skill with no description is listed
but never advertised; add `disable-model-invocation: true` to its frontmatter to
keep it out of the model's list entirely. Loading asks for permission by default
— control this with `skills.allow` / `skills.deny` (patterns support `*` and the
last match wins, e.g. `"deny": ["*"], "allow": ["docs-*"]`). Skills are loaded
into RAM only, like everything else, and the discovered set is wiped on exit.

### Web access (optional, read-only)

Off by default. Enable it to give the model two tools, `web_search` and
`web_fetch`, built to only ever **read**:

- **No writes.** Only `GET`, plus a `POST` of the query to your search engine.
  The model can never POST data to an arbitrary host.
- **Allowlisted reads.** `web_fetch` only accepts URLs that came back from
  `web_search` in the current session.
- **No local network.** Private, loopback, link-local and metadata addresses
  (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, `::1`, `fe80::`,
  `fc00::/7`) are refused, and every redirect is re-checked.
- **Bounded.** Size and time caps on every request.

Enabling it means the harness is no longer strictly loopback-only; rokaru shows a
`web access enabled (read-only)` toast when it starts.

<details>
<summary>Web config &amp; search backends</summary>

```json
"web": {
  "enabled": true,
  "searchURL": "https://search.brave.com/search?q={query}",
  "maxResults": 5,
  "maxBytes": 600000,
  "timeoutMs": 15000,
  "fetchOnlySearchResults": true
}
```

Search uses a chain of keyless engines (Brave → Bing → DuckDuckGo) because scraped
engines block automated clients over time; it falls through until one returns
results. You can override `searchURL` (use `{query}`) or point it at a SearxNG
instance.

</details>

### Themes

`/themes` (alias `/theme`) opens a picker for the built-in palettes (**onyx,
graphite, glacier, nocturne, lagoon, plum, contrast, ember, blossom, daylight,
grid**) and lets you build a custom one. Colours update live, including the whole
terminal background; custom themes are session-only. The list scrolls, and the
start-screen logo/rain adapt to a light background.

## Configuration

`~/.config/rokaru/config.json` (created on first run; `0700` dir, `0600` file):

```json
{
  "baseURL": "http://127.0.0.1:8000/v1",
  "systemPrompt": "You are rokaru...",
  "inputHeight": 10,
  "sampling": {
    "temperature": 0.7,
    "topP": 0.95,
    "topK": 20,
    "maxTokens": 4096,
    "minP": 0.0,
    "repetitionPenalty": 1.0,
    "presencePenalty": 0.0
  },
  "modelSampling": {},
  "sandbox": { "extraWritePaths": [] },
  "web": { "enabled": false },
  "mcp": { "servers": {} },
  "skills": {},
  "tools": { "maxResultChars": 24000, "maxResultTokens": 6000, "maxRounds": 100 },
  "diagnostics": { "enabled": true, "command": "" },
  "learning": { "enabled": true, "persist": false, "minRuns": 3 },
  "ui": { "reduceMotion": false, "highContrast": false },
  "notify": true
}
```

`sampling` sets the defaults for every model. A `repetitionPenalty` above `1.0`
(or a little `minP`) helps with models that loop; `1.0` means off. Override any of
these for a single model by id under `modelSampling`, for example:

```json
"modelSampling": { "Ling-3.0-tiny-oQ6e": { "repetitionPenalty": 1.1 } }
```

`ui.reduceMotion` disables the animated start-screen rain, fades, spinners and
pulses — handy over SSH/tmux or on a slow terminal. `ui.highContrast` starts in
the `contrast` palette. Setting the `NO_COLOR` environment variable turns both on.

The API key is resolved from `ROKARU_OMLX_KEY` or `OMLX_LOCAL_KEY`, then the
macOS Keychain (service `rokaru-omlx`), then the local default `sk-omlx-local`,
and is never written to disk by rokaru.

## Roadmap / ideas

A running list of improvements under consideration. Shipped work is documented in
the sections above; nothing here changes rokaru's core promise: fully local,
RAM-only, and opt-in.

- **Sandbox the post-edit diagnostics command.** It currently runs unsandboxed
  (`/bin/zsh` with the full environment), unlike the `bash` tool.
- **Guard writes by sensitive path.** `write_file`/`edit_file` aren't checked
  against the protected-path list the way reads are.
- **Fix the dead MCP permission preview.** MCP tools register as
  `mcp__server__tool`, so the dedicated `mcp_call` preview never fires.
- **Hot-reload `AGENTS.md`** (and config) instead of caching for the session.
- **Machine-portable tests.** `scripts/sandbox.test.ts` and
  `scripts/render-prompt.test.tsx` hardcode this machine's paths.
- **Headless one-shot mode.** `rokaru -p "…"` for scripted, non-interactive runs.
- **Custom slash commands.** User-authored prompt templates in
  `.rokaru/commands/*.md`.
- **Session checkpoints.** Named snapshots of the whole session's file state.
- **`/init`.** Generate a starter `AGENTS.md` from the repo layout.
- **Edit-and-resend / branch** from an earlier user message.
- **Remote (HTTP) MCP servers**, beyond the current stdio-only support.
- **Auto-format hook.** Run the project's formatter on changed files after edits.

## Acknowledgements

rokaru's look, feel and feature set are partly inspired by
[**opencode**](https://github.com/anomalyco/opencode), and it's built on
[**@opentui**](https://github.com/anomalyco/opentui). This is an independent
implementation; neither project's code is used here.

## License

[MIT](LICENSE) © 2026 Ash Eskrett
