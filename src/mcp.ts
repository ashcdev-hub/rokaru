import { spawn, type ChildProcess } from "node:child_process"
import type { McpConfig, McpServerConfig } from "./config"
import type { ToolDef } from "./tools/types"
import { VERSION } from "./version"

const PROTOCOL_VERSION = "2024-11-05"
const REQUEST_TIMEOUT_MS = 20_000
const CALL_TIMEOUT_MS = 120_000
const MAX_LINE_BYTES = 8_000_000

interface Pending {
  resolve: (value: any) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export interface McpToolInfo {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean }
}

export class McpClient {
  private child: ChildProcess
  private buffer = ""
  private nextId = 1
  private pending = new Map<number, Pending>()
  private closed = false

  constructor(
    readonly serverName: string,
    private readonly config: McpServerConfig,
  ) {
    this.child = spawn(config.command, config.args ?? [], {
      env: { ...process.env, ...(config.env ?? {}) },
      stdio: ["pipe", "pipe", "ignore"],
    })
    this.child.stdout?.setEncoding("utf8")
    this.child.stdout?.on("data", (chunk: string) => this.onData(chunk))
    this.child.on("error", (error) => this.failAll(error))
    this.child.on("exit", () => this.failAll(new Error(`${this.serverName} exited`)))
  }

  private onData(chunk: string): void {
    this.buffer += chunk
    if (this.buffer.length > MAX_LINE_BYTES) {
      this.buffer = ""
      return
    }
    let newline: number
    while ((newline = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newline).trim()
      this.buffer = this.buffer.slice(newline + 1)
      if (line.length === 0) continue
      let message: any
      try {
        message = JSON.parse(line)
      } catch {
        continue
      }
      this.handleMessage(message)
    }
  }

  private handleMessage(message: any): void {
    if (typeof message?.id === "number" && ("result" in message || "error" in message)) {
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      clearTimeout(pending.timer)
      if (message.error) pending.reject(new Error(String(message.error.message ?? "MCP error")))
      else pending.resolve(message.result)
      return
    }
    // Server-initiated request: answer politely so it doesn't hang.
    if (typeof message?.id === "number" && typeof message?.method === "string") {
      this.write({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "not supported" } })
    }
    // Notifications are ignored.
  }

  private write(payload: unknown): void {
    if (this.closed) return
    try {
      this.child.stdin?.write(JSON.stringify(payload) + "\n")
    } catch {
      // ignore
    }
  }

  private failAll(error: Error): void {
    this.closed = true
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }

  private request(method: string, params: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<any> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${this.serverName}: ${method} timed out`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.write({ jsonrpc: "2.0", id, method, params })
    })
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "rokaru", version: VERSION },
    })
    this.write({ jsonrpc: "2.0", method: "notifications/initialized" })
  }

  async listTools(): Promise<McpToolInfo[]> {
    const result = await this.request("tools/list", {})
    return Array.isArray(result?.tools) ? result.tools : []
  }

  async callTool(name: string, args: unknown, signal?: AbortSignal): Promise<string> {
    const result = await this.request("tools/call", { name, arguments: args ?? {} }, CALL_TIMEOUT_MS)
    const parts: string[] = []
    if (Array.isArray(result?.content)) {
      for (const item of result.content) {
        if (item?.type === "text" && typeof item.text === "string") parts.push(item.text)
        else if (typeof item?.text === "string") parts.push(item.text)
        else parts.push(JSON.stringify(item))
      }
    } else {
      parts.push(JSON.stringify(result))
    }
    const text = parts.join("\n")
    return result?.isError ? `error: ${text}` : text
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    try {
      this.child.kill("SIGTERM")
    } catch {
      // ignore
    }
  }
}

const clients = new Map<string, McpClient>()

export function shutdownMcp(): void {
  for (const client of clients.values()) client.close()
  clients.clear()
}

export interface McpServerConnectResult {
  tools: ToolDef[]
  toolNames: string[]
  error?: string
}

// Start (or restart) a single server and return its tools. Does not register
// them; the caller decides.
export async function connectServer(name: string, config: McpServerConfig): Promise<McpServerConnectResult> {
  disconnectServer(name)
  const client = new McpClient(name, config)
  try {
    await client.initialize()
    const remoteTools = await client.listTools()
    clients.set(name, client)
    const tools: ToolDef[] = remoteTools.map((remote) => {
      const toolName = `mcp__${name}__${remote.name}`
      const readOnly = remote.annotations?.readOnlyHint === true
      return {
        name: toolName,
        description: `[${name}] ${remote.description ?? remote.name}`,
        destructive: !readOnly,
        parameters: (remote.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} },
        async run(args, ctx) {
          return client.callTool(remote.name, args, ctx.signal)
        },
      }
    })
    return { tools, toolNames: tools.map((tool) => tool.name) }
  } catch (error) {
    client.close()
    return { tools: [], toolNames: [], error: (error as Error).message }
  }
}

export function disconnectServer(name: string): void {
  const client = clients.get(name)
  if (client) client.close()
  clients.delete(name)
}

export interface McpServerStatus {
  name: string
  tools: number
  error?: string
}

export interface McpConnectResult {
  tools: ToolDef[]
  servers: McpServerStatus[]
  errors: string[]
}

export async function connectMcp(config: McpConfig): Promise<McpConnectResult> {
  const tools: ToolDef[] = []
  const servers: McpServerStatus[] = []
  const errors: string[] = []
  for (const [serverName, serverConfig] of Object.entries(config.servers ?? {})) {
    const result = await connectServer(serverName, serverConfig)
    if (result.error) {
      servers.push({ name: serverName, tools: 0, error: result.error })
      errors.push(`${serverName}: ${result.error}`)
    } else {
      servers.push({ name: serverName, tools: result.tools.length })
      tools.push(...result.tools)
    }
  }
  return { tools, servers, errors }
}
