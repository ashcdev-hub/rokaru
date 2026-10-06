import { bashTool } from "./bash"
import { editFileTool, globTool, grepTool, listDirTool, readFileTool, writeFileTool } from "./fs"
import { viewImageTool } from "./image"
import { webFetchTool, webSearchTool } from "./web"
import type { ToolDef } from "./types"

export const TOOLS: ToolDef[] = [
  readFileTool,
  listDirTool,
  globTool,
  grepTool,
  viewImageTool,
  webSearchTool,
  webFetchTool,
  writeFileTool,
  editFileTool,
  bashTool,
]

export const TOOL_MAP = new Map(TOOLS.map((tool) => [tool.name, tool]))

const WEB_TOOLS = new Set(["web_search", "web_fetch"])

export function toolSchemas(webEnabled = false) {
  return TOOLS.filter((tool) => webEnabled || !WEB_TOOLS.has(tool.name)).map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}

export type { ToolContext } from "./types"
