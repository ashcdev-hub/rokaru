import type { ToolDef } from "./types"

// Executed by the agent loop (it needs the model client + a nested history), so
// run() is only a guard; the schema is what matters here.
export const taskTool: ToolDef = {
  name: "task",
  description:
    "Delegate a focused, read-only research or investigation sub-task to a subagent that has its own context. Give it a clear prompt; it returns a concise answer. The subagent cannot edit files or run commands.",
  destructive: false,
  parameters: {
    type: "object",
    properties: {
      description: { type: "string", description: "Short label for the sub-task" },
      prompt: { type: "string", description: "What the subagent should investigate and report" },
    },
    required: ["prompt"],
  },
  async run() {
    throw new Error("the task tool is handled by the agent loop")
  },
}
