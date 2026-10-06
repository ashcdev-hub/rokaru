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
}

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  run(args: any, ctx: ToolContext): Promise<string>
  // Destructive tools prompt before running.
  destructive: boolean
}
