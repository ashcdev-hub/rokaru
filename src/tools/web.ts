import { mkdirSync } from "node:fs"
import { dirname, isAbsolute, resolve } from "node:path"
import type { WebConfig } from "../config"
import { downloadToFile, webFetchPage, webSearch } from "../web"
import { assertWritable } from "./fs"
import type { ToolContext, ToolDef } from "./types"

function webConfig(ctx: ToolContext): WebConfig {
  if (!ctx.web?.enabled) {
    throw new Error("web access is disabled (set web.enabled true in ~/.config/rokaru/config.json)")
  }
  return ctx.web
}

export const webSearchTool: ToolDef = {
  name: "web_search",
  description:
    "Search the web (read-only) and return result titles, URLs and snippets. Use web_fetch to read one of the results. You cannot post or send any data anywhere.",
  destructive: false,
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "Search query" } },
    required: ["query"],
  },
  async run(args, ctx) {
    const config = webConfig(ctx)
    const query = String(args?.query ?? "").trim()
    if (query.length === 0) throw new Error("empty query")
    const results = await webSearch(query, config)
    if (results.length === 0) return "(no results)"
    return results
      .map((result, index) => `${index + 1}. ${result.title}\n   ${result.url}\n   ${result.snippet}`)
      .join("\n\n")
  },
}

export const webFetchTool: ToolDef = {
  name: "web_fetch",
  description:
    "Read a web page as plain text (read-only GET). Only URLs returned by web_search in this session are permitted.",
  destructive: false,
  parameters: {
    type: "object",
    properties: { url: { type: "string", description: "URL to read" } },
    required: ["url"],
  },
  async run(args, ctx) {
    const config = webConfig(ctx)
    const url = String(args?.url ?? "").trim()
    if (url.length === 0) throw new Error("empty url")
    const { text } = await webFetchPage(url, config)
    return text.length > 0 ? text : "(empty page)"
  },
}

export const webDownloadTool: ToolDef = {
  name: "web_download",
  description:
    "Download a file from a public http(s) URL and save the raw bytes into the workspace (read-only GET; never uploads). Use for binaries, archives or images that web_fetch cannot read as text. Returns the saved path and byte count.",
  destructive: true,
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "Public http(s) URL to download" },
      path: { type: "string", description: "Destination path, relative to the workspace unless absolute" },
    },
    required: ["url", "path"],
  },
  async run(args, ctx) {
    const config = webConfig(ctx)
    const url = String(args?.url ?? "").trim()
    const path = String(args?.path ?? "").trim()
    if (url.length === 0) throw new Error("empty url")
    if (path.length === 0) throw new Error("empty path")
    const target = isAbsolute(path) ? path : resolve(ctx.workspace, path)
    assertWritable(ctx, target)
    mkdirSync(dirname(target), { recursive: true })
    const result = await downloadToFile(url, target, config, { signal: ctx.signal })
    return `downloaded ${result.bytes} bytes to ${target}\ncontent-type: ${result.contentType || "(unknown)"}`
  },
}
