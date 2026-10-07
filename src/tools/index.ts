import { bashTool } from "./bash"
import { editFileTool, globTool, grepTool, listDirTool, readFileTool, writeFileTool } from "./fs"
import { replaceInFilesTool } from "./replace"
import { viewImageTool } from "./image"
import { questionTool } from "./question"
import { taskTool } from "./task"
import { todoWriteTool } from "./todo"
import { webFetchTool, webSearchTool } from "./web"
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

// Tools contributed by MCP servers at runtime.
const dynamicTools = new Map<string, ToolDef>()

export function registerDynamicTools(list: ToolDef[]): void {
  for (const tool of list) dynamicTools.set(tool.name, tool)
}

export function unregisterDynamicTools(names: string[]): void {
  for (const name of names) dynamicTools.delete(name)
}

export function clearDynamicTools(): void {
  dynamicTools.clear()
}

export function getTool(name: string): ToolDef | undefined {
  return TOOL_MAP.get(name) ?? dynamicTools.get(name)
}

const WEB_TOOLS = new Set(["web_search", "web_fetch"])

export function toolSchemas(webEnabled = false, planMode = false) {
  return [...TOOLS, ...dynamicTools.values()]
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
