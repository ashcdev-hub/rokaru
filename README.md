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
coding agent. It reads and edits files, runs commands and plans work — all on
your machine.

## Highlights

- **Fully local.** Only local oMLX models. The one optional network path is the
  read-only web tools.
- **Sandboxed.** Shell commands run with **all network denied** and writes
  confined to your workspace; sensitive paths are refused.
- **RAM-only.** No transcript, history or log touches disk; on exit it's wiped.
- **Self-tuning.** A private, content-free scorecard learns which model works
  best per task and suggests better choices.

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
| `/image <path>` | Attach an image to your next message. |
| `/compact` | Summarise the conversation to reclaim context. |
| `/undo` · `/redo` | Revert / re-apply the model's last file edit. |
| `/changes` | Review the files changed this session and revert one. |
| `/retry` | Re-run your last message and regenerate the reply. |
| `/tune` · `/good` · `/bad` | Self-tuning scoreboard and turn labels. |
| `/find <text>` | Jump through conversation matches. |
| `/mcp` | Enable/disable MCP servers (all at once or one by one). |
| `/skills` | List available skills. |
| `/purge-cache` | Delete oMLX session KV-cache (server must be stopped). |
| `/privacy-check` | Send a canary and scan oMLX for any on-disk trace. |
| `/themes` | Switch colour theme (alias `/theme`). |
| `/clear` · `/new` | Start over. |
| `/help` · `/exit` | List commands / quit. |

**Keys:** `enter` send · `shift+enter` newline · `tab` plan/build · `esc`
interrupt · `pgup`/`pgdn` scroll · `ctrl+r` reasoning · `ctrl+o` expand tools ·
`ctrl+y` copy reply · `ctrl+a` copy the whole session · `ctrl+b` sidebar ·
`ctrl+x` cancel the running tool · `ctrl+p` palette.

## Optional features

- **Web access (read-only, off by default).** `web_search` finds pages,
  `web_fetch` reads one as text, and `web_download` saves a file into your
  workspace. Only `GET` requests; private/loopback/metadata addresses are
  refused; every redirect is re-checked.
- **MCP servers (stdio).** Local MCP servers start disabled each launch and are
  toggled per session from `/mcp`.
- **Skills.** Reusable instruction packs the model loads on demand from
  `~/.config/rokaru/skills/`, `.rokaru/skills/`, or `skills.sources`.
- **Themes.** `/themes` opens a live picker for the built-in palettes or a custom
  one; your choice is remembered between sessions.

## Privacy & security

- **RAM-only sessions.** No transcript, history or log is written to disk. On
  exit (`ctrl+c`, `SIGTERM`, crash) buffers are wiped.
- **Local by default.** The oMLX connection is checked against `127.0.0.1` /
  `::1` / `localhost`; anything else is refused, and proxy env vars are stripped.
- **Sandboxed tools.** `bash` runs under `sandbox-exec` with all network denied
  and writes confined to the workspace + temp. File writes are workspace-confined.
- **Protected paths.** Tools and the sandbox refuse to read `~/.ssh`, `~/.aws`,
  keychains, browser data, the oMLX config and other secret locations.
- **Secrets.** The API key comes from env or the macOS Keychain, never written to
  disk; config is `0700`/`0600`. No telemetry.

Caveat: your prompts still pass through oMLX, which keeps its own KV cache and
usage DB. Run **`/privacy-check`** to confirm what oMLX actually left on disk.

## Configuration

`~/.config/rokaru/config.json` (created on first run):

```json
{
  "baseURL": "http://127.0.0.1:8000/v1",
  "inputHeight": 10,
  "sampling": { "temperature": 0.7, "topP": 0.95, "topK": 20, "maxTokens": 4096 },
  "web": { "enabled": false },
  "mcp": { "servers": {} },
  "ui": { "reduceMotion": false, "highContrast": false, "theme": "onyx" }
}
```

`sampling` sets defaults for every model; override per model by id under
`modelSampling`. `repetitionPenalty` above `1.0` helps models that loop. The
`omlx` block tunes warm-up, prefill progress and token counting. Set
`NO_COLOR` to force reduced motion and high contrast. See
[`src/config.ts`](src/config.ts) for every field and its default.

## Development

rokaru is a Bun + [@opentui/solid](https://github.com/anomalyco/opentui)
(TypeScript/TSX) app. Run it from source with `bun run dev`; run the suite with
`bun run test`. See [**CONTRIBUTING.md**](CONTRIBUTING.md) for the architecture,
project layout, testing and release process.

## Acknowledgements

rokaru's look, feel and feature set are partly inspired by
[**opencode**](https://github.com/anomalyco/opencode), and it's built on
[**@opentui**](https://github.com/anomalyco/opentui). This is an independent
implementation; neither project's code is used here.

## License

[MIT](LICENSE) © 2026 Ash Eskrett
