import { bashTool } from "./bash"
import { editFileTool, globTool, grepTool, listDirTool, readFileTool, writeFileTool } from "./fs"
import { replaceInFilesTool } from "./replace"
import { viewImageTool } from "./image"
import { questionTool } from "./question"
import { taskTool } from "./task"
import { todoWriteTool } from "./todo"
import { webFetchTool, webSearchTool } from "./web"
import { dynamicToolList, getDynamicTool } from "./registry"
import type { ToolDef } from "./types"

export const TOOLS: ToolDef[] = [
  readFileTool,
  listDirTool,
  globTool,
  grepTool,
  viewImageTool,
  questionTool,
  taskTool,
  todoWriteTool,
  webSearchTool,
  webFetchTool,
  writeFileTool,
  editFileTool,
  replaceInFilesTool,
  bashTool,
]

export const TOOL_MAP = new Map(TOOLS.map((tool) => [tool.name, tool]))

// MCP tools are registered at runtime by mcp.ts.
export { registerDynamicTools, unregisterDynamicTools, clearDynamicTools } from "./registry"

export function getTool(name: string): ToolDef | undefined {
  return TOOL_MAP.get(name) ?? getDynamicTool(name)
}

const WEB_TOOLS = new Set(["web_search", "web_fetch"])

// MCP tools are injected directly (not lazily): models call them reliably this
// way, and hiding them behind a search step proved fragile.
export function toolSchemas(webEnabled = false, planMode = false) {
  return [...TOOLS, ...dynamicToolList()]
    .filter((tool) => (webEnabled || !WEB_TOOLS.has(tool.name)) && (!planMode || !tool.destructive))
    .map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
}

export type { ToolContext } from "./types"
