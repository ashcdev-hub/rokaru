import * as store from "../store"
import type { ToolDef } from "./types"

const STATUSES = new Set(["pending", "in_progress", "completed"])

export const todoWriteTool: ToolDef = {
  name: "todo_write",
  description:
    "Replace the task list for the current work. Use this to plan and track multi-step tasks; keep exactly one item in_progress at a time and mark items completed as you finish them.",
  destructive: false,
  parameters: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        description: "The full task list, in order",
        items: {
          type: "object",
          properties: {
            content: { type: "string", description: "What needs doing" },
            status: { type: "string", enum: ["pending", "in_progress", "completed"] },
          },
          required: ["content", "status"],
        },
      },
    },
    required: ["todos"],
  },
  async run(args) {
    const raw = Array.isArray(args?.todos) ? args.todos : []
    const list: store.TodoItem[] = raw
      .filter((item: any) => item && typeof item.content === "string")
      .map((item: any) => ({
        content: String(item.content),
        status: STATUSES.has(item.status) ? item.status : "pending",
      }))
    store.setTodos(list)
    if (list.length === 0) return "(no todos)"
    return list
      .map((item) => `- [${item.status === "completed" ? "x" : item.status === "in_progress" ? ">" : " "}] ${item.content}`)
      .join("\n")
  },
}
