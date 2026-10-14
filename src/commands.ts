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
  { name: "undo", description: "revert the model's last file edit (see /undo list)" },
  { name: "redo", description: "re-apply the last undone edit" },
  { name: "changes", description: "review and revert files changed this session" },
  { name: "retry", description: "re-run your last message and regenerate the reply" },
  { name: "tune", description: "show the self-tuning scoreboard" },
  { name: "good", description: "mark the last turn as good (trains tuning)" },
  { name: "bad", description: "mark the last turn as bad (trains tuning)" },
  { name: "allow-all", description: "auto-approve all tool calls for this session" },
  { name: "find", description: "search the conversation" },
  { name: "clear", description: "clear the conversation" },
  { name: "new", description: "start a new conversation" },
  { name: "mcp", description: "enable/disable MCP servers" },
  { name: "skills", description: "list available skills" },
  { name: "purge-cache", description: "delete oMLX session KV-cache (server must be stopped)" },
  { name: "privacy-check", description: "send a canary and scan oMLX for leaked session data" },
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

// The most-used command names (for the "frequent" section), needs-first.
export function frequentCommandNames(usage: Record<string, number>, limit = 3): string[] {
  return Object.entries(usage)
    .filter(([name, count]) => count > 0 && COMMANDS.some((command) => command.name === name))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name)
}

// The one ordering both the / menu and the App's enter/tab handling must use, so
// the highlighted row and the chosen command never disagree. With an empty query
// the frequent commands float to the top.
export function orderedMenuCommands(prefix: string, usage: Record<string, number>): CommandSpec[] {
  const matches = matchCommands(prefix)
  if (prefix.trim().length !== 0) return matches
  const frequent = frequentCommandNames(usage)
  if (frequent.length === 0) return matches
  const front = frequent
    .map((name) => matches.find((command) => command.name === name))
    .filter((command): command is CommandSpec => command !== undefined)
  const rest = matches.filter((command) => !frequent.includes(command.name))
  return [...front, ...rest]
}
