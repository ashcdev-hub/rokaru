import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

export interface SamplingConfig {
  temperature: number
  topP: number
  topK: number
  maxTokens: number
}

export interface SandboxConfig {
  // Extra absolute paths the sandboxed bash tool may write to, beyond the
  // workspace root and the system temp dir.
  extraWritePaths: string[]
}

export interface WebConfig {
  // Off by default. When on, the model gets read-only web tools and the
  // harness may make outbound HTTPS requests (still never POSTs data).
  enabled: boolean
  searchURL: string
  maxResults: number
  maxBytes: number
  timeoutMs: number
  // Only allow fetching URLs that came back from a web_search this session.
  fetchOnlySearchResults: boolean
}

export interface McpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface McpConfig {
  // Local stdio MCP servers. Each is spawned as a child process.
  servers: Record<string, McpServerConfig>
}

export interface RokaruConfig {
  baseURL: string
  systemPrompt: string
  // Fixed height of the prompt box, in text rows (excluding the border).
  inputHeight: number
  sampling: SamplingConfig
  sandbox: SandboxConfig
  web: WebConfig
  mcp: McpConfig
}

export const CONFIG_DIR = join(homedir(), ".config", "rokaru")
export const CONFIG_PATH = join(CONFIG_DIR, "config.json")
export const KEYCHAIN_SERVICE = "rokaru-omlx"

export const DEFAULT_SYSTEM_PROMPT = [
  "You are rokaru, a terse coding agent running against a local model.",
  "You operate in the user's current working directory; that is your workspace.",
  "Use the provided tools to inspect and modify files. Read before you edit.",
  "Prefer small, exact changes. Never invent file contents or fabricate results.",
  "Keep replies short and concrete; explain only what is needed.",
].join(" ")

export const DEFAULT_CONFIG: RokaruConfig = {
  baseURL: "http://127.0.0.1:8000/v1",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  inputHeight: 8,
  sampling: {
    temperature: 0.7,
    topP: 0.95,
    topK: 20,
    maxTokens: 4096,
  },
  sandbox: {
    extraWritePaths: [],
  },
  web: {
    enabled: false,
    searchURL: "https://search.brave.com/search?q={query}",
    maxResults: 5,
    maxBytes: 600_000,
    timeoutMs: 15_000,
    fetchOnlySearchResults: true,
  },
  mcp: {
    servers: {},
  },
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true, mode: 0o700 })
  try {
    chmodSync(path, 0o700)
  } catch {
    // best effort
  }
}

function writePrivate(path: string, contents: string): void {
  writeFileSync(path, contents, { mode: 0o600 })
  try {
    chmodSync(path, 0o600)
  } catch {
    // best effort
  }
}

function mergeConfig(partial: Partial<RokaruConfig>): RokaruConfig {
  return {
    baseURL: partial.baseURL ?? DEFAULT_CONFIG.baseURL,
    systemPrompt: partial.systemPrompt ?? DEFAULT_CONFIG.systemPrompt,
    inputHeight: partial.inputHeight ?? DEFAULT_CONFIG.inputHeight,
    sampling: { ...DEFAULT_CONFIG.sampling, ...(partial.sampling ?? {}) },
    sandbox: { ...DEFAULT_CONFIG.sandbox, ...(partial.sandbox ?? {}) },
    web: { ...DEFAULT_CONFIG.web, ...(partial.web ?? {}) },
    mcp: { servers: { ...DEFAULT_CONFIG.mcp.servers, ...(partial.mcp?.servers ?? {}) } },
  }
}

export function loadConfig(): RokaruConfig {
  ensureDir(CONFIG_DIR)
  if (!existsSync(CONFIG_PATH)) {
    writePrivate(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n")
    return { ...DEFAULT_CONFIG }
  }
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<RokaruConfig>
    try {
      chmodSync(CONFIG_PATH, 0o600)
    } catch {
      // best effort
    }
    return mergeConfig(parsed)
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

function keychainKey(): string | undefined {
  const result = spawnSync(
    "/usr/bin/security",
    ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"],
    { encoding: "utf8" },
  )
  if (result.status !== 0) return undefined
  const value = result.stdout.trim()
  return value.length > 0 ? value : undefined
}

// Resolution order: explicit env override, then macOS Keychain, then the
// documented local default. The key is never written to disk by rokaru.
export function resolveApiKey(): string {
  const fromEnv = process.env.ROKARU_OMLX_KEY ?? process.env.OMLX_LOCAL_KEY
  if (fromEnv && fromEnv.length > 0) return fromEnv
  return keychainKey() ?? "sk-omlx-local"
}
