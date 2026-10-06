# Changelog

All notable changes to rokaru. Version is shown on the start screen and in the
sidebar.

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
