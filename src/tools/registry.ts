// Runtime-registered tools (MCP servers). Kept in a separate module so the MCP
// meta-tools can look them up without importing the tool list itself.

import type { ToolDef } from "./types"

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

export function getDynamicTool(name: string): ToolDef | undefined {
  return dynamicTools.get(name)
}

export function dynamicToolList(): ToolDef[] {
  return [...dynamicTools.values()]
}

export function hasDynamicTools(): boolean {
  return dynamicTools.size > 0
}
