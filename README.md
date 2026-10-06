<p align="center">
  <img src="assets/rokaru.png" alt="rokaru" width="420">
</p>

Private local harness for **oMLX** — an agentic terminal UI, like a small
opencode, that only ever talks to your own machine.

## Privacy & security

- **RAM-only sessions.** No transcript, history, or log is written to disk. On
  exit (`ctrl+c`, `SIGTERM`, crash) buffers are wiped; there's nothing on disk to
  recover.
- **Loopback only.** Every request is checked against `127.0.0.1` / `::1` /
  `localhost`; anything else is refused. Proxy env vars are stripped.
- **Sandboxed tools.** `bash` runs under `sandbox-exec` with **all network
  denied** and writes confined to the workspace + temp. `write_file` / `edit_file`
  are workspace-confined too.
- **Secrets.** The API key comes from env or the macOS Keychain, never written to
  disk. Config dir `~/.config/rokaru` is `0700`, file `0600`.
- **No telemetry.**

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

`enter` send · `shift+enter` newline · `esc` abort · `ctrl+r` toggle reasoning ·
`ctrl+c` quit. Selecting text with the mouse copies it to the clipboard.

Commands: `/model` to switch model (re-fetches from oMLX), `/model <name>` to
switch directly.

## Tools

`read_file`, `list_dir`, `glob`, `grep` run automatically; `write_file`,
`edit_file`, `bash` ask for permission (navigate with `↑`/`↓`, `enter`).

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
bun run test:security   # sandbox + loopback guard
bun run test:render     # TUI snapshots + selection-to-clipboard
bun run test:agent      # full agent loop (needs oMLX)
bun run typecheck
```
