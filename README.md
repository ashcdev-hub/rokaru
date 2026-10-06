<p align="center">
  <img src="assets/rokaru.png" alt="rokaru" width="420">
</p>

Private local TUI harness for [**oMLX**](https://github.com/jundot/omlx) on apple silicon.

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

## Requirements & install

macOS with **Bun**, and **oMLX already running** with a model loaded (rokaru
never starts/stops oMLX).

```sh
ln -sfn ~/dev/rokaru/bin/rokaru /usr/local/bin/rokaru
```

## Usage

```sh
cd ~/some/project
rokaru
```

`enter` send · `shift+enter` newline · `esc` abort · `ctrl+r` toggle all thinking ·
`ctrl+o` expand tool output · `ctrl+c` quit. `↑`/`↓` recall earlier prompts.
Click a **Thought** line to expand/collapse that message's reasoning. Tool calls
render as their own panels (with red/green diffs for edits), and a moving meter
shows while the model is working. Selecting text with the mouse copies it.

## Commands

Type `/` for a menu (tab completes):

- `/model` — switch model (list re-fetched from oMLX), or `/model <name>` to
  switch directly.
- `/image <path>` — attach an image (png/jpg/jpeg/gif/webp/bmp) to your next
  message; the model sees it. The model can also open images itself with the
  `view_image` tool.
- `/compact` — summarise the conversation to reclaim context.
- `/clear`, `/new` — start over.
- `/help` — list commands.

A prompt sent while the model is working is queued and sent when it's free.

## Tools

`read_file`, `list_dir`, `glob`, `grep`, `view_image` run automatically;
`write_file`, `edit_file`, `bash` ask first. Choose **allow once**,
**always allow** (stops asking for that tool for the rest of the session) or
**deny** with `↑`/`↓` and `enter` (or `y`/`a`/`n`).

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

Enabling it means the harness is no longer strictly loopback-only; the sidebar
Privacy panel shows `web: read-only` while it's on.

```json
"web": {
  "enabled": true,
  "searchURL": "https://html.duckduckgo.com/html/",
  "maxResults": 5,
  "maxBytes": 600000,
  "timeoutMs": 15000,
  "fetchOnlySearchResults": true
}
```

## Config

`~/.config/rokaru/config.json`:

```json
{
  "baseURL": "http://127.0.0.1:8000/v1",
  "systemPrompt": "You are rokaru...",
  "inputHeight": 8,
  "sampling": { "temperature": 0.7, "topP": 0.95, "topK": 20, "maxTokens": 4096 },
  "sandbox": { "extraWritePaths": [] }
}
```

## Tests

```sh
bun run test:security   # sandbox, loopback guard, protected paths
bun run test:unit       # diff engine + edit diffs
bun run test:render     # TUI snapshots + selection-to-clipboard
bun run test:agent      # full agent loop (needs oMLX)
bun run test:image      # /image + view_image (needs oMLX)
bun run test:web        # web safety guards + live search/fetch (needs network)
bun run typecheck
```
