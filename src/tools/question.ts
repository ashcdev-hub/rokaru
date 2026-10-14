import type { ToolDef } from "./types"

// Executed by the agent loop (it needs the interactive UI), so run() is only
// a guard; the schema is what matters here.
export const questionTool: ToolDef = {
  name: "question",
  description:
    "Ask the user a question with 2 to 6 predefined options. ALWAYS use this tool instead of writing questions, numbered lists, or (a)/(b)/(c) choices in your reply text. The user picks one option, types their own answer, or dismisses. Set multiSelect to true to let the user check several options and submit the set.",
  destructive: false,
  parameters: {
    type: "object",
    properties: {
      question: { type: "string", description: "The question to ask" },
      options: {
        type: "array",
        description: "Two to six options (label plus an optional short description each)",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            description: { type: "string" },
          },
          required: ["label"],
        },
      },
      multiSelect: {
        type: "boolean",
        description: "Allow the user to select more than one option (default false)",
      },
    },
    required: ["question", "options"],
  },
  async run() {
    throw new Error("the question tool is handled by the agent loop")
  },
}
