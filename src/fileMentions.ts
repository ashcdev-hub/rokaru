// Lightweight @file mentions for the prompt. Lists workspace files (cached for
// a few seconds) and matches the trailing `@query` token so the user can insert
// a path without typing it in full.

const SKIP_SEGMENTS = new Set([
  ".git",
  "node_modules",
  ".rokaru",
  "dist",
  "build",
  ".next",
  ".turbo",
  "target",
  "vendor",
])
const MAX_FILES = 2000
const CACHE_MS = 4000

let cache: { workspace: string; files: string[]; at: number } | undefined

export function workspaceFiles(workspace: string): string[] {
  const now = Date.now()
  if (cache && cache.workspace === workspace && now - cache.at < CACHE_MS) return cache.files
  const files: string[] = []
  try {
    const glob = new Bun.Glob("**/*")
    for (const rel of glob.scanSync({ cwd: workspace, onlyFiles: true })) {
      if (rel.split("/").some((segment) => SKIP_SEGMENTS.has(segment))) continue
      files.push(rel)
      if (files.length >= MAX_FILES) break
    }
  } catch {
    // workspace unreadable
  }
  files.sort()
  cache = { workspace, files, at: now }
  return files
}

export function resetMentionCache(): void {
  cache = undefined
}

// The trailing `@query` token, if the input ends with one. `start` is the index
// of the `@` so a selection can replace the whole token.
export function extractMention(value: string): { query: string; start: number } | undefined {
  const match = /(^|\s)@([^\s@]*)$/.exec(value)
  if (!match) return undefined
  return { query: match[2], start: match.index + match[1].length }
}

export interface MentionMatch {
  files: string[]
  query: string
  start: number
  end: number
}

export function mentionMatches(value: string, workspace: string, limit = 8): MentionMatch | undefined {
  if (value.startsWith("/")) return undefined
  const found = extractMention(value)
  if (!found) return undefined
  const needle = found.query.toLowerCase()
  const files = workspaceFiles(workspace)
    .filter((file) => needle.length === 0 || file.toLowerCase().includes(needle))
    .slice(0, limit)
  if (files.length === 0) return undefined
  return { files, query: found.query, start: found.start, end: value.length }
}

// Replace the `@query` token with the chosen path plus a trailing space.
export function applyMention(value: string, match: MentionMatch, file: string): string {
  return `${value.slice(0, match.start)}@${file} `
}
