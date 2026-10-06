export interface CommandSpec {
  name: string
  description: string
}

export const COMMANDS: CommandSpec[] = [
  { name: "model", description: "switch model" },
  { name: "plan", description: "read-only planning mode (toggle with /build)" },
  { name: "build", description: "full editing mode" },
  { name: "image", description: "attach an image file to your next message" },
  { name: "compact", description: "summarise the conversation to free context" },
  { name: "undo", description: "revert the model's last file edit" },
  { name: "find", description: "search the conversation" },
  { name: "clear", description: "clear the conversation" },
  { name: "new", description: "start a new conversation" },
  { name: "mcp", description: "list connected MCP servers" },
  { name: "themes", description: "switch colour theme" },
  { name: "help", description: "list commands" },
  { name: "exit", description: "quit rokaru (wipes the session)" },
]

// Aliases resolve to another command; /quit behaves as /exit and shows as /exit.
export const COMMAND_ALIASES: Record<string, string> = {
  quit: "exit",
  q: "exit",
  theme: "themes",
}

export function resolveCommandName(name: string): string {
  return COMMAND_ALIASES[name.toLowerCase()] ?? name
}

export function matchCommands(prefix: string): CommandSpec[] {
  const p = prefix.toLowerCase()
  return COMMANDS.filter(
    (command) =>
      command.name.startsWith(p) ||
      Object.entries(COMMAND_ALIASES).some(([alias, target]) => target === command.name && alias.startsWith(p)),
  )
}
