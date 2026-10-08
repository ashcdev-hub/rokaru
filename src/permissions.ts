// The key under which an "always allow" decision is remembered for a tool call.
export function permissionKey(name: string, args: any): string {
  if (name === "bash") return String(args?.command ?? "").trim().split(/\s+/)[0] ?? ""
  if (name === "mcp_call") return `mcp_call:${String(args?.tool ?? "").trim()}`
  return name
}

// Whether a tool call still needs a permission prompt. `autoApprove` is the
// session-wide "allow all tools" switch.
export function needsPermission(input: {
  name: string
  destructive: boolean
  args: any
  autoApprove: boolean
  isToolAllowed: (key: string) => boolean
  isCommandAllowed: (word: string) => boolean
}): boolean {
  if (!input.destructive || input.autoApprove) return false
  const key = permissionKey(input.name, input.args)
  return input.name === "bash" ? !input.isCommandAllowed(key) : !input.isToolAllowed(key)
}
