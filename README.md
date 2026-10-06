# rokaru

A private, ephemeral, agentic TUI harness for a locally-running **oMLX** server.
It looks and behaves like a small opencode: a main conversation/input pane on the
left and a live status sidebar on the right. Everything about a run lives in
memory and is wiped when the harness exits.

```
cd ~/some/project
rokaru
```

## Requirements

- macOS with **Bun** on `PATH`.
- **oMLX already running** with a model loaded. rokaru never starts, stops,
  or restarts oMLX — if it can't reach it, it says so and exits.

## Install

The source lives at `~/dev/rokaru` and the command is symlinked on PATH:

```sh
ln -sfn ~/dev/rokaru/bin/rokaru /usr/local/bin/rokaru
```

(`/usr/local/bin` is writable by your user; no sudo needed.)

## Logo

On startup, rokaru runs `cli-ascii-logo "rokaru" -p cyberpunk --random` through a
pty and uses its output, so you get a **different colour gradient every launch**.
The whole startup screen (logo, model picker, hints) is centred.

If `cli-ascii-logo` isn't installed, rokaru falls back to a saved
`assets/ascii-logo.txt` / `.ans` (see `assets/README.md`), and finally to a
built-in block logo coloured with a random palette.

## Layout

```
┌──────── main pane (left) ────────┬── sidebar (right) ──┐
│  conversation · reasoning        │  Session Context    │
│  tool calls + results            │  ████░░░░ 16%       │
│                                  │  21.4k / 131.1k     │
│                                  │  Model Speed        │
│                                  │  TTFT 1.5s          │
├──────────────────────────────────┤  TPS 27.4 t/s       │
│  > prompt                        │  Model · Session    │
└──────────────────────────────────┴─────────────────────┘
```

TTFT and t/s are **measured**, taken directly from oMLX's usage chunk
(`time_to_first_token`, `generation_tokens_per_second`), not estimated. The
context gauge reads the live `max_model_len` from `/v1/models`; rokaru sets no
context limit of its own — oMLX enforces that.

## Keys

| Key | Action |
| --- | --- |
| `enter` | send |
| `shift+enter` / `alt+enter` | newline |
| `esc` | abort the current turn |
| `ctrl+r` | toggle reasoning display |
| `↑` / `↓` | choose allow/deny on a permission prompt |
| `enter` | confirm the highlighted permission choice |
| `y` / `n` | quick allow / deny |
| `ctrl+c` | quit (wipes the session) |

Selecting text with the mouse (drag) **copies it to the clipboard automatically**
and shows a brief "copied to clipboard" toast — the same behaviour as opencode.

## Commands

Type these in the prompt:

- `/model` — switch model. The list is re-fetched from oMLX, so a model you just
  added appears here. Choose with `↑`/`↓`, `enter` to confirm, `esc` to cancel.
- `/model <name>` — switch straight to the model whose id contains `<name>`.

## Tools

`read_file`, `list_dir`, `glob`, `grep` (auto-run) and `write_file`,
`edit_file`, `bash` (ask for permission each time).

`bash` runs under `sandbox-exec` with:

- **all network denied** (including loopback),
- writes allowed only to the workspace and temp directories (`/tmp`,
  `/private/tmp`, `$TMPDIR`), plus any `sandbox.extraWritePaths` you add.

The in-process `write_file` / `edit_file` tools are likewise confined to the
workspace. Reads are not globally restricted (development tooling needs them).

## Privacy & security

Guaranteed for the harness itself:

- **RAM-only sessions.** No transcript, history, or log is ever written to disk.
  On exit (`ctrl+c`, `SIGTERM`, `SIGHUP`, crash) buffers are zeroised and refs
  dropped. There is nothing on disk to recover.
- **Loopback only.** Every outbound request is checked against
  `127.0.0.1` / `::1` / `localhost`; anything else throws. Proxy environment
  variables are stripped at startup.
- **No telemetry.**
- **Secrets.** The API key is read from `ROKARU_OMLX_KEY` / `OMLX_LOCAL_KEY`,
  else the macOS Keychain, else the documented local default; it is never
  written by rokaru. Config dir `~/.config/rokaru` is `0700`, config file
  `0600`.

**Not** covered — read this part:

- rokaru talks to oMLX, so **your prompts pass through oMLX** and are
  reflected in oMLX's own SSD-backed KV cache (`~/.omlx/cache`), its request log
  (token counts), and `~/.omlx/usage.sqlite3`. rokaru does **not** touch
  those; erasing them is manual and requires stopping oMLX first.
- The `bash` sandbox blocks network and confines writes, but tool commands can
  still **read** files your user can read. Do not point it at a machine with
  secrets you don't want fed to a model.

## Configuration

`~/.config/rokaru/config.json` (created on first run):

```json
{
  "baseURL": "http://127.0.0.1:8000/v1",
  "systemPrompt": "You are rokaru, a terse coding agent...",
  "inputHeight": 8,
  "sampling": { "temperature": 0.7, "topP": 0.95, "topK": 20, "maxTokens": 4096 },
  "sandbox": { "extraWritePaths": [] }
}
```

`inputHeight` is the fixed height of the prompt box in text rows (default `8`);
it no longer grows or shrinks as you type.

Optional — store the key in the Keychain instead of the default:

```sh
security add-generic-password -a "$USER" -s rokaru-omlx -w sk-omlx-local -U
```

## Tests

```sh
bun run test:security   # sandbox + loopback guard (no server needed)
bun run test:render     # sidebar snapshot
bun run test:agent      # full agent loop (needs oMLX + a loaded model)
bun run typecheck
```
