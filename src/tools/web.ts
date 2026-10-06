import type { WebConfig } from "../config"
import { webFetchPage, webSearch } from "../web"
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
