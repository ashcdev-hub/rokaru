export interface CommandSpec {
  name: string
  description: string
}

export const COMMANDS: CommandSpec[] = [
  { name: "model", description: "switch model" },
  { name: "image", description: "attach an image file to your next message" },
  { name: "compact", description: "summarise the conversation to free context" },
  { name: "clear", description: "clear the conversation" },
  { name: "new", description: "start a new conversation" },
  { name: "help", description: "list commands" },
]

export function matchCommands(prefix: string): CommandSpec[] {
  const p = prefix.toLowerCase()
  return COMMANDS.filter((command) => command.name.startsWith(p))
}
