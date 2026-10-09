import { bashTool } from "./bash"
import { editFileTool, globTool, grepTool, listDirTool, readFileTool, writeFileTool } from "./fs"
import { replaceInFilesTool } from "./replace"
import { viewImageTool } from "./image"
import { questionTool } from "./question"
import { taskTool } from "./task"
import { todoWriteTool } from "./todo"
import { webFetchTool, webSearchTool } from "./web"
import { dynamicToolList, getDynamicTool } from "./registry"
import { skillTool } from "./skill"
import type { ToolDef } from "./types"
import type { ToolSchema } from "../omlx"
import type { Skill } from "../skills"

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

// A rendered `skill` tool schema. The description advertises the invocable
// skills (id + name + description) so the model knows they exist; the model
// loads one by calling the tool with its exact id. `skills` is empty when none
// are available.
export function skillSchemas(skills: Skill[]): ToolDef {
  const body = skills
    .map((skill) => `  - ${skill.id} · ${skill.name} · ${skill.description}`)
    .join("\n")
  const advertised = skills.length > 0 ? `\nInvocable skills:\n${body}` : ""
  return {
    ...skillTool,
    description: `Load a skill's instructions into the conversation by calling this tool with a skill's exact id.${advertised}`,
  }
}

// MCP tools are injected directly (not lazily): models call them reliably this
// way, and hiding them behind a search step proved fragile. The `skill` tool is
// injected with a description that reflects the current skill set.
export function toolSchemas(webEnabled = false, planMode = false, skills: Skill[] = []): ToolSchema[] {
  const base = [...TOOLS, ...dynamicToolList()]
    .filter((tool) => (webEnabled || !WEB_TOOLS.has(tool.name)) && (!planMode || !tool.destructive))
  const withSkill = [...base, skillSchemas(skills)]
  return withSkill.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}

export type { ToolContext } from "./types"
