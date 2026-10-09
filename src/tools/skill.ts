import type { ToolDef } from "./types"

// The `skill` tool. The model calls it with a skill id to load that skill's
// instructions into the conversation. It is loader-driven (handled by the agent
// loop), so run() is only a guard; the schema — which advertises the available
// skills — is what matters.
export const skillTool: ToolDef = {
  name: "skill",
  description:
    "Load a skill's instructions into the conversation. Call it with the exact id of a skill you want to use; rokaru then adds the skill's instructions and supporting file paths to the chat.",
  destructive: false,
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "The exact id of the skill to load" },
    },
    required: ["id"],
  },
  async run() {
    throw new Error("the skill tool is handled by the agent loop")
  },
}
