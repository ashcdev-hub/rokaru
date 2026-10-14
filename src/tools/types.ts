import type { WebConfig } from "../config"
import type { DiffLine } from "../diff"

export interface ToolContext {
  workspace: string
  extraWritePaths: string[]
  signal: AbortSignal
  web?: WebConfig
  // Optional sink for a structured diff produced by a mutating tool.
  onDiff?: (diff: DiffLine[]) => void
  // Optional sink for an image (data URL) a tool wants the model to see.
  onImage?: (dataUrl: string) => void
  // Optional sink for a tool's partial output while it runs (e.g. bash stdout),
  // so the transcript can show progress before the call completes.
  onOutput?: (chunk: string) => void
}

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  run(args: any, ctx: ToolContext): Promise<string>
  // Destructive tools prompt before running.
  destructive: boolean
  // Optional per-call override. Allows a single tool (e.g. an MCP proxy) to be
  // read-only or destructive depending on its arguments.
  destructiveFor?(args: any): boolean
}
