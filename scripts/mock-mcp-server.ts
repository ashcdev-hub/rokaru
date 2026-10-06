// Minimal MCP stdio server used to test rokaru's MCP client.
// Speaks newline-delimited JSON-RPC 2.0.

function respond(id: unknown, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n")
}

function handle(message: any): void {
  switch (message.method) {
    case "initialize":
      respond(message.id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "mock-mcp", version: "1.0.0" },
      })
      return
    case "notifications/initialized":
      return
    case "tools/list":
      respond(message.id, {
        tools: [
          {
            name: "echo",
            description: "Echo text back",
            inputSchema: {
              type: "object",
              properties: { text: { type: "string" } },
              required: ["text"],
            },
            annotations: { readOnlyHint: true },
          },
          {
            name: "danger",
            description: "Pretend to change something",
            inputSchema: { type: "object", properties: {} },
          },
        ],
      })
      return
    case "tools/call":
      respond(message.id, {
        content: [{ type: "text", text: `echo: ${message.params?.arguments?.text ?? ""}` }],
      })
      return
    default:
      if (message.id !== undefined) {
        respond(message.id, {})
      }
  }
}

process.stdin.setEncoding("utf8")
let buffer = ""
process.stdin.on("data", (chunk: string) => {
  buffer += chunk
  let newline: number
  while ((newline = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newline).trim()
    buffer = buffer.slice(newline + 1)
    if (line.length === 0) continue
    try {
      handle(JSON.parse(line))
    } catch {
      // ignore
    }
  }
})
