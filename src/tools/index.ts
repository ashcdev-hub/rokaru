import { bashTool } from "./bash"
import { editFileTool, globTool, grepTool, listDirTool, readFileTool, writeFileTool } from "./fs"
import type { ToolDef } from "./types"

export const TOOLS: ToolDef[] = [
  readFileTool,
  listDirTool,
  globTool,
  grepTool,
  writeFileTool,
  editFileTool,
  bashTool,
]

export const TOOL_MAP = new Map(TOOLS.map((tool) => [tool.name, tool]))

export function toolSchemas() {
  return TOOLS.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}

export type { ToolContext } from "./types"
