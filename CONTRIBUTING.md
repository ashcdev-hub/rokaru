# Developing rokaru

This is the developer and contributor guide. For what rokaru is and how to
install it, see the [README](README.md). For a user-facing list of changes, see
the [CHANGELOG](CHANGELOG.md).

rokaru is a terminal UI (TUI) written in TypeScript/TSX. It renders with
[`@opentui/solid`](https://github.com/anomalyco/opentui) (SolidJS bindings over
OpenTUI's native renderer) and runs on [Bun](https://bun.sh). It talks to a local
[oMLX](https://github.com/jundot/omlx) server over HTTP.

## Requirements

- macOS on Apple Silicon.
- [Bun](https://bun.sh) (the runtime, package manager and test runner).
- An oMLX server running locally with a model loaded (only needed to exercise the
  app end-to-end; unit and render tests run without it).

## Getting started

```sh
git clone https://github.com/ashcdev-hub/rokaru.git ~/dev/rokaru
cd ~/dev/rokaru
bun install
bun run dev        # launch the TUI from source
```

`bin/rokaru` is the installed launcher: it resolves its own location, then runs
`src/index.tsx` with the caller's directory handed over as the workspace (via
`ROKARU_WORKSPACE`). `bun run dev` runs from the repo root with the current
directory as the workspace.

Type-check the whole project at any time:

```sh
bun run typecheck   # tsc --noEmit
```

## Testing

Tests are plain Bun scripts under `scripts/`, not a test-framework suite. Each
one prints `PASS`/`FAIL` lines and exits non-zero on failure.

```sh
bun run test            # security + unit + render (the full gate)
bun run test:security   # sandbox / sensitive-path behaviour (scripts/sandbox.test.ts)
bun run test:unit       # pure logic: diff, redact, tokens, learning, cache, …
bun run test:render     # TUI snapshots via @opentui/solid testRender
bun run test:web        # live web_search/web_fetch (needs network; SKIPs if offline)
bun run test:mcp        # spawns a mock stdio MCP server (scripts/mock-mcp-server.ts)
bun run test:agent      # end-to-end turn against a local oMLX server
bun run test:image      # image attach/encode path
```

`test:unit` and `test:render` are the ones to run before every commit. Render
tests mount components with `testRender`, drive input through `mockInput`, and
assert on `captureCharFrame()` (plain text) or `captureSpans()` (per-span `fg`/`bg`
— use this to check highlighting). See `scripts/render-prompt.test.tsx` for a
representative example.

## Repository layout

```
bin/rokaru            launcher script (symlink this onto your PATH)
src/
  index.tsx           entry point: render(<App />)
  App.tsx             top-level state, screen routing, keyboard, command dispatch
  agent.ts            the turn loop: stream -> tool calls -> results -> repeat
  omlx.ts             oMLX HTTP client (chat streaming, models, health, load)
  omlxCache.ts        session KV-cache helpers (/purge-cache)
  config.ts           config schema, defaults, load/save, key resolution
  store.ts            global Solid signals — all cross-component UI state
  permissions.ts      which tool calls need a prompt / "always allow" keys
  sandbox.ts          sandbox-exec profile for the bash tool
  guard.ts            loopback-only network guard, proxy-env stripping
  sensitive.ts        protected-path list (~/.ssh, keychains, …)
  redact.ts           secret-shape masking for tool output
  web.ts              web_search / web_fetch / web_download + safety guards
  mcp.ts              stdio MCP client and per-server lifecycle
  commands.ts         command specs and the / menu ordering
  theme.ts            palettes, theme registry, colour roles
  skills.ts           skill discovery and permission rules
  learning.ts         self-tuning scorecard (content-free)
  undo.ts, diff.ts    in-memory edit snapshots and diffing
  tokens.ts, metrics.ts, errors.ts, lifecycle.ts, privacyCheck.ts, …
  tools/              the model-facing toolset
    index.ts          the TOOLS list + toolSchemas() (what the model sees)
    types.ts          ToolDef / ToolContext interfaces
    fs.ts             read_file, list_dir, glob, grep, write_file, edit_file
    bash.ts           sandboxed shell
    web.ts            web_search, web_fetch, web_download
    replace.ts, image.ts, question.ts, task.ts, todo.ts, skill.ts, cache.ts
    registry.ts       runtime-registered (MCP) tools
  components/         TUI components (ChatView, InputBox, McpPanel, …)
scripts/              tests, mock servers and dev probes
```

## Architecture

**One turn** starts in `App.submit`, which calls `runTurn` in `src/agent.ts`:

1. Build the system prompt (base prompt + workspace `AGENTS.md` + mode line) and
   the tool schemas from `toolSchemas()` in `src/tools/index.ts`.
2. `streamChat` (`src/omlx.ts`) streams the reply, folding text/thinking/tool-call
   fragments into `store` signals as they arrive.
3. For each tool call, the agent looks the tool up with `getTool(name)`, checks
   `needsPermission` (`src/permissions.ts`), and — if allowed — runs it with a
   `ToolContext` (workspace, signal, write paths, optional diff/image/output
   sinks). Results are redacted (`src/redact.ts`) and capped by
   `tools.maxResultChars`/`maxResultTokens`.
4. Steps 2–3 repeat until the model stops calling tools or hits `tools.maxRounds`.
   Context overflow triggers auto-compaction; `esc` requests a soft stop.

**State** lives in `src/store.ts` as Solid signals (`status`, `messages`,
`mcpServers`, `pasteBlocks`, …). Components read them reactively; `App.tsx` owns
screen routing (chat, palette, `/mcp`, `/themes`, model picker, …).

**Safety invariants** are deliberate and must not regress:

- No session data is written to disk. Buffers are zeroed and the screen cleared on
  exit (`src/lifecycle.ts`).
- Outbound HTTP is loopback-only unless web access is enabled; proxy env vars are
  stripped.
- `bash` runs under `sandbox-exec` with network denied and writes confined to the
  workspace + temp (`src/sandbox.ts`).
- Protected paths are refused by tools and the sandbox (`src/sensitive.ts`).
- The API key is read from env/Keychain and is never persisted.

## Adding a tool

1. Define a `ToolDef` (`src/tools/types.ts`) — `name`, `description`,
   `parameters` (JSON schema), `destructive`, and `run(args, ctx)` returning a
   string. Keep the description terse; it goes into the prompt.
2. Register it in the `TOOLS` array in `src/tools/index.ts`. If it should be
   hidden when a feature is off, add its name to the relevant set (e.g.
   `WEB_TOOLS`).
3. `destructive: true` tools prompt before running and are hidden in plan mode.
   If destructiveness depends on the arguments, add `destructiveFor(args)`.
4. Add a case to `scripts/tools.test.ts` (and `scripts/modes.test.ts` for
   plan/build visibility) asserting whether it's offered.

## Adding a command

1. Add a `CommandSpec` to `COMMANDS` in `src/commands.ts` (name + one-line
   description). Aliases go in `COMMAND_ALIASES`.
2. Handle it in the `switch` inside `runCommand` in `src/App.tsx`. Output plain
   text via `store.addInfoMessage(...)`, transient notices via `store.showToast(...)`,
   or open a panel by setting the matching `store` signal.
3. If it has a `/`-menu entry, update the help text in `showHelp` (`src/App.tsx`).
4. Add coverage in `scripts/commandMenu.test.ts` if you changed menu ordering.

## Adding a theme

Add a palette to `BUILTIN_THEMES` in `src/theme.ts`, matching the `Theme`
interface (every colour role). New colours used by the custom-theme editor also
go in `THEME_COLOURS`. Extend the "new palettes" assertion in
`scripts/theme.test.ts`.

## Conventions

- Match the surrounding style: 2-space indent, no semicolons, double quotes,
  named exports. Comments explain *why*, not *what*.
- Keep dependencies minimal — the project ships with `@opentui/*` and `solid-js`
  only. Discuss before adding a package.
- Prefer pure, testable helpers (see `diff.ts`, `tokens.ts`, `listWindow.ts`) and
  keep I/O at the edges.
- Never log or persist secrets, prompts or file contents.

## Versioning & releases

Versions are semantic and shown on the start screen and sidebar (read from
`package.json` via `src/version.ts`).

- A new feature or a large change bumps the **minor** version (`0.16.0` → `0.17.0`).
- A bug fix, docs or other small change bumps the **patch** version
  (`0.17.0` → `0.17.1`).

To cut a release:

1. Bump `version` in `package.json` (the single source of truth).
2. Add a dated section to `CHANGELOG.md`, grouped as **Added** / **Changed** /
   **Fixed** / **Removed**.
3. Run `bun run typecheck` and `bun run test`.
4. Commit with the house style, e.g.
   `rokaru 0.17.0: <short summary of the release>`, then push.

The local `AGENTS.md` (gitignored) carries maintainer-specific instructions; it is
never committed.
