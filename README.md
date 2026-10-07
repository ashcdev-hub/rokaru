<p align="center">
  <img src="assets/rokaru.png" alt="rokaru" width="420">
</p>

<h3 align="center">A private, local-first coding agent for <a href="https://github.com/jundot/omlx">oMLX</a> on Apple Silicon.</h3>

<p align="center">
  <img alt="platform" src="https://img.shields.io/badge/platform-macOS-black?style=flat-square">
  <img alt="runtime" src="https://img.shields.io/badge/runtime-Bun-f472b6?style=flat-square">
  <img alt="serves" src="https://img.shields.io/badge/serves-oMLX-7c5cff?style=flat-square">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-3b82f6?style=flat-square">
</p>

rokaru is a terminal UI that turns a local model served by **oMLX** into a
coding agent inside your project directory. It reads and edits files, runs
commands and plans work, while keeping everything on your machine and out of
long-term storage.

## Why rokaru

- **Fully local.** The model runs on your Mac through oMLX. The only path to the
  internet is the optional, read-only web tools.
- **RAM-only sessions.** No transcript, history or log is written to disk; on
  exit (`ctrl+c`, `SIGTERM`, crash) buffers are wiped, so there is nothing to
  recover.
- **Sandboxed tools.** Shell commands run with **all network denied** and writes
  confined to your workspace; sensitive paths are refused outright.
- **Plan, then build.** A read-only planning mode where the writing and exec
  tools aren't even offered to the model.

## Quick start

**Requirements:** macOS on Apple Silicon, [Bun](https://bun.sh), and an
[oMLX](https://github.com/jundot/omlx) server already running with a model loaded.

```sh
git clone https://github.com/ashcdev-hub/rokaru.git ~/dev/rokaru
ln -sfn ~/dev/rokaru/bin/rokaru /usr/local/bin/rokaru

cd ~/some/project
rokaru
```

rokaru uses your current working directory as the workspace.

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
| `/undo` | Revert the model's last file edit. |
| `/find <text>` | Jump through conversation matches (`n` next, `p` prev). |
| `/clear` · `/new` | Start over. |
| `/mcp` | Enable/disable MCP servers (interactive panel). |
| `/purge-cache` | Delete oMLX session KV-cache (oMLX server must be stopped). |
| `/privacy-check` | Send a canary request and scan oMLX for any on-disk trace. |
| `/themes` | Switch colour theme (alias `/theme`). |
| `/help` | List commands. |
| `/exit` | Quit (alias `/quit`). |

A prompt sent while the model is working is queued and sent when it's free.

## Privacy & security

- **RAM-only sessions.** No transcript, history or log is written to disk. On
  exit (`ctrl+c`, `SIGTERM`, crash) buffers are wiped; there's nothing to recover.
- **Local by default.** The oMLX connection is checked against `127.0.0.1` / `::1`
  / `localhost`; anything else is refused. Proxy env vars are stripped.
- **Sandboxed tools.** `bash` runs under `sandbox-exec` with all network denied
  and writes confined to the workspace + temp; `write_file` / `edit_file` are
  workspace-confined too.
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

## Features

### Tools

`read_file`, `list_dir`, `glob`, `grep`, `view_image`, `task`, `todo_write` and
`question` run automatically; `write_file`, `edit_file` and `bash` ask first.
Choose **allow once**, **always allow** (for the rest of the session) or **deny**
with `↑`/`↓` and `enter` (or `y`/`a`/`n`). The prompt previews what will run (a
`$` block for `bash`, a diff for edits), and tool output is scanned for credential
shapes and masked before it reaches the model.

<details>
<summary>Tooling details</summary>

- For `bash`, "always allow" remembers just the leading command word (e.g. `git`).
- `read_file` pages large files with `offset`/`limit`.
- `task` delegates a read-only investigation to a subagent with its own context.
- `question` takes over the prompt with a pick list (`↑↓`/`1-6` to choose,
  `enter` to answer, `esc` dismisses, or type your own answer) instead of asking
  in plain text.
- Pastes longer than a few lines collapse to a `Pasted N lines` row and send with
  your message (`⌫` on an empty box drops them); the box grows to `inputHeight`
  rows (default 10).
- Each result is capped by `tools.maxResultChars` (default 24,000); rounds per
  turn by `tools.maxRounds` (default 100; `0` = unlimited).
- **Project context & checks.** A workspace `AGENTS.md` is loaded into the system
  prompt. After edits, rokaru runs the project check once (a detected `typecheck`
  script, a local `tsc`, or `diagnostics.command`) and feeds failures back to be
  fixed. Disable with `diagnostics.enabled: false`.

</details>

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
graphite, glacier, nocturne, lagoon, plum**) and lets you build a custom one.
Colours update live, including the whole terminal background; custom themes are
session-only.

## Configuration

`~/.config/rokaru/config.json` (created on first run; `0700` dir, `0600` file):

```json
{
  "baseURL": "http://127.0.0.1:8000/v1",
  "systemPrompt": "You are rokaru...",
  "inputHeight": 10,
  "sampling": { "temperature": 0.7, "topP": 0.95, "topK": 20, "maxTokens": 4096 },
  "sandbox": { "extraWritePaths": [] },
  "web": { "enabled": false },
  "mcp": { "servers": {} },
  "tools": { "maxResultChars": 24000, "maxRounds": 100 },
  "diagnostics": { "enabled": true, "command": "" },
  "notify": true
}
```

The API key is resolved from `ROKARU_OMLX_KEY` or `OMLX_LOCAL_KEY`, then the
macOS Keychain (service `rokaru-omlx`), then the local default `sk-omlx-local`,
and is never written to disk by rokaru.

## Acknowledgements

rokaru's look, feel and feature set are partly inspired by
[**opencode**](https://github.com/anomalyco/opencode), and it's built on
[**@opentui**](https://github.com/anomalyco/opentui). This is an independent
implementation; neither project's code is used here.

## License

[MIT](LICENSE) © 2026 Ash Eskrett
