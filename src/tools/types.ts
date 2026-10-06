export interface ToolContext {
  workspace: string
  extraWritePaths: string[]
  signal: AbortSignal
}

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  run(args: any, ctx: ToolContext): Promise<string>
  // Destructive tools prompt before running.
  destructive: boolean
}
