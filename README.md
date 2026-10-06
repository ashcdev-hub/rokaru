<p align="center">
  <img src="assets/rokaru.png" alt="rokaru" width="420">
</p>

Private local AI harness for [**oMLX**](https://github.com/jundot/omlx) on apple silicon.

## Requirements & install

Rokaru is a TUI which requires macOS with **Bun**, and **oMLX already running** with a model loaded (rokaru
never starts/stops oMLX).

```sh
ln -sfn ~/dev/rokaru/bin/rokaru /usr/local/bin/rokaru
```

## Usage

```sh
cd ~/some/project
rokaru
```

`enter` send · `shift+enter` newline · `esc` abort · `tab` switch plan/build ·
`ctrl+r` toggle all thinking · `ctrl+o` expand tool output · `ctrl+p` command
palette · `ctrl+c` quit. `↑`/`↓` recall earlier prompts. Click a **Thought** line
to expand/collapse that message's reasoning; click a **tool panel** to expand it.
Tool calls render as their own panels with a per-category icon, a duration and
red/green diffs for edits. User messages are tinted to separate turns, and a
moving meter shows while the model is working. Selecting text copies it.

## Modes

- **build** (default) — full editing and command running.
- **plan** — read-only: the model can read, search, browse and plan, but the
  writing/exec tools aren't even offered. Switch with `/plan` and `/build` (also
  in the `ctrl+p` palette). Build is amber and plan is light blue; the mode and
  active model show on the prompt footer. Replies render as markdown with
  numbers, dates, emphasis and inline code coloured for readability; a **Todo**
  panel appears in the sidebar while the agent works through a task list, and an
  **MCP** panel lists connected servers once you enable any. Session Context
  shows a cached-vs-new token bar with a cache-hit %; Model Speed shows
  TTFT/TPS/OUT/elapsed, colour-graded; and the current git branch shows under the
  header.

## Commands

Type `/` for a menu (tab completes), or `ctrl+p` for the palette:

- `/model` — switch model (list re-fetched from oMLX), or `/model <name>`.
- `/plan`, `/build` — toggle read-only planning / full editing.
- `/image <path>` — attach an image (png/jpg/jpeg/gif/webp/bmp) to your next
  message; the model sees it. The model can also open images itself with
  `view_image`.
- `/compact` — summarise the conversation to reclaim context.
- `/undo` — revert the model's last file edit (in-memory; also wiped on exit).
- `/find <text>` — search the conversation.
- `/clear`, `/new` — start over.
- `/help` — list commands.
- `/mcp` — enable/disable MCP servers (interactive panel).
- `/themes` — switch colour theme (alias `/theme`). See below.
- `/exit` — quit (the alias `/quit` resolves to it).

A prompt sent while the model is working is queued and sent when it's free.

## Privacy & security

- **RAM-only sessions.** No transcript, history, or log is written to disk. On
  exit (`ctrl+c`, `SIGTERM`, crash) buffers are wiped; there's nothing on disk to
  recover.
- **Local by default.** The oMLX connection is checked against `127.0.0.1` / `::1`
  / `localhost`; anything else is refused. Proxy env vars are stripped. The only
  way anything reaches the internet is the optional read-only web tools below.
- **Sandboxed tools.** `bash` runs under `sandbox-exec` with **all network
  denied** and writes confined to the workspace + temp. `write_file` / `edit_file`
  are workspace-confined too.
- **Protected paths.** Tools and the sandbox refuse to read `~/.ssh`, `~/.aws`,
  keychains, browser data, the oMLX config and other secret locations.
- **Secrets.** The API key comes from env or the macOS Keychain, never written to
  disk. Config dir `~/.config/rokaru` is `0700`, file `0600`.
- **No telemetry.** On exit the screen and scrollback are cleared and core dumps
  are disabled.

Caveats: your prompts still pass through oMLX, which keeps its own KV cache and
usage DB — rokaru doesn't touch those. And the sandbox blocks network and writes,
but not **reads**; don't point it at a box full of secrets.

## Tools

`read_file`, `list_dir`, `glob`, `grep`, `view_image`, `todo_write` run
automatically; `write_file`, `edit_file`, `bash` ask first. Choose **allow once**,
**always allow** (stops asking for that tool for the rest of the session) or
**deny** with `↑`/`↓` and `enter` (or `y`/`a`/`n`). The prompt previews what will
run (a `$` block for `bash`, a diff for edits). For `bash`, "always allow"
remembers just the leading command word (e.g. `git`). Tool output is scanned for
credential shapes and masked before it reaches the model.

## MCP servers (optional)

rokaru speaks **stdio** MCP only (local child processes) — remote `url`-based
servers aren't supported. Declare them under `mcp.servers`; they start
**disabled on every launch** and are opt-in per session, so a fresh start stays
fast with no extra tool schemas in the prompt.

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

Run **`/mcp`** for an interactive panel — `↑`/`↓` to move, `enter` to toggle a
server on/off, `esc` to close. Each server's status (connected / disabled /
error, with tool count) shows there and in the sidebar **MCP** panel. Read-only
tools (MCP `readOnlyHint`) run automatically; everything else asks first.
Servers are shut down when rokaru exits; toggling is session-only, not saved.

## Web access (optional, read-only)

Off by default. Enable it in the config to give the model two tools:

- `web_search` — search the web and return titles, URLs and snippets.
- `web_fetch` — read one page as plain text.

It is built to only ever **read**:

- **No writes.** Only `GET`, plus a `POST` of the query to your search engine.
  The model can never POST data to an arbitrary host.
- **Allowlisted reads.** `web_fetch` only accepts URLs that came back from
  `web_search` in the current session — the model can't fetch arbitrary URLs.
- **No local network.** Private, loopback, link-local and metadata addresses
  (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `169.254/16`, `::1`, `fe80::`,
  `fc00::/7`) are refused, and every redirect is re-checked.
- **Bounded.** Size and time caps on every request.

Enabling it means the harness is no longer strictly loopback-only; rokaru shows
a `web access enabled (read-only)` toast when it starts.

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

Search uses a chain of keyless engines (Brave → Bing → DuckDuckGo) because
scraped engines block automated clients over time; it falls through until one
returns results, and you can override `searchURL` (use `{query}`, or point it at
a SearxNG instance).

## Themes

`/themes` (or `/theme`) opens a picker for the built-in palettes — **slate,
github, nord, dracula, solarized, rosepine**. `↑`/`↓` to move, `enter` to apply
(colours update live), `esc` to close. Pick **new theme** to build a custom
palette: `↑`/`↓` choose a role, `←`/`→` cycle its colour, `enter` saves it as
`custom`/`custom-2` and applies it. Custom themes are session-only (wiped on
exit, like everything else).

## Config

`~/.config/rokaru/config.json`:

```json
{
  "baseURL": "http://127.0.0.1:8000/v1",
  "systemPrompt": "You are rokaru...",
  "inputHeight": 8,
  "sampling": { "temperature": 0.7, "topP": 0.95, "topK": 20, "maxTokens": 4096 },
  "sandbox": { "extraWritePaths": [] },
  "web": { "enabled": false },
  "mcp": { "servers": {} }
}
```

## Tests

```sh
bun run test:security   # sandbox, loopback guard, protected paths
bun run test:unit       # diff engine, tool schemas/modes, redaction, highlighting, themes
bun run test:render     # TUI snapshots + selection-to-clipboard
bun run test:agent      # full agent loop (needs oMLX)
bun run test:image      # /image + view_image (needs oMLX)
bun run test:web        # web safety guards + live search/fetch (needs network)
bun run test:mcp        # MCP client against a mock stdio server
bun run typecheck
```
