// Agent Skills (opencode / MCP compatible).
//
// A skill is a directory containing a SKILL.md file whose YAML frontmatter
// carries name + description. The directory form is recommended so the skill
// can carry supporting files with a private base directory. IDs are derived
// from the final path segment of the skill's directory (or file), not the
// frontmatter name — exactly as opencode does.
//
// Discovery is local-only and RAM-only: nothing is written to disk, and the
// discovered list is wiped on exit like everything else in a session.

import { readdirSync, statSync, existsSync, readFileSync, type Dirent } from "node:fs"
import { join, basename, dirname, resolve } from "node:path"
import { homedir } from "node:os"
import type { SkillsConfig } from "./config"

export interface Skill {
  // Path-derived, case-sensitive, kebab-ish id (e.g. "git-release").
  id: string
  // Frontmatter name (display label; may differ from the id).
  name: string
  // Frontmatter description; empty means the model never advertises this skill.
  description: string
  // Absolute path to the directory containing SKILL.md (or the .md file).
  root: string
  // Absolute path to the entry file (SKILL.md, or the loose .md file itself).
  file: string
  // True when the skill opts out of being advertised to the model.
  hidden: boolean
}

export interface LoadedSkill {
  // Markdown body with frontmatter stripped.
  body: string
  // Absolute directory the skill lives in; relative references resolve here.
  dir: string
  // Sample of up to MAX_SUPPORTING_FILES supporting file paths (sorted,
  // excluding SKILL.md itself), relative to the skill dir.
  files: string[]
}

const MAX_SUPPORTING_FILES = 10

// Resolve a source path relative to the current working directory, honouring
// "~/..." and absolute paths the same way opencode does.
function resolveSource(source: string): string {
  if (source.startsWith("~/")) return join(homedir(), source.slice(2))
  if (source.startsWith("~")) return join(homedir(), source.slice(1))
  if (source.startsWith("/") || /^[A-Za-z]:[\\/]/.test(source)) return source
  return join(process.cwd(), source)
}

// Parse the small slice of YAML frontmatter we care about. Not a general
// YAML parser — just enough to read name, description and the two
// disable/advance flags under metadata.
function parseFrontmatter(text: string): { name: string; description: string; hidden: boolean } {
  let body = text
  let frontmatter = ""
  if (text.startsWith("---\n") || text.startsWith("---\r\n")) {
    const end = text.indexOf("\n---", 4)
    if (end !== -1) {
      frontmatter = text.slice(4, end)
      body = text.slice(end + 4)
    }
  } else if (text.startsWith("---")) {
    const end = text.indexOf("\r\n---\r\n")
    const endAlt = text.indexOf("\n---\n")
    const idx = endAlt === -1 ? end : end === -1 ? endAlt : Math.min(end, endAlt)
    if (idx !== -1) {
      frontmatter = text.slice(4, idx)
      body = text.slice(idx + 4)
    }
  }

  const name = frontmatter.match(/^\s*name:\s*(.*)$/m)?.[1]?.trim() ?? ""
  const description = frontmatter.match(/^\s*description:\s*(.*)$/m)?.[1]?.trim() ?? ""
  // disable-model-invocation and opencode/autoinvoke both hide a skill from the
  // model's advertised list.
  const hidden =
    /disable-model-invocation:\s*(true|yes)/i.test(frontmatter) || /opencode\/autoinvoke:\s*(true|yes)/i.test(frontmatter)

  return { name, description, hidden }
}

// The project root: the nearest ancestor of the workspace that contains a .git
// entry, or the workspace itself when there is none. Discovery is scoped to the
// project, so directories above the repo are never scanned (opencode behaves
// the same way).
function projectRoot(workspace: string): string {
  let dir = resolve(workspace)
  let depth = 0
  while (depth < 64) {
    if (existsSync(join(dir, ".git"))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
    depth += 1
  }
  return resolve(workspace)
}

// Project skill source dirs, project root first and workspace last, so nearer
// sources are merged later (later wins on id collision).
function projectSourceDirs(workspace: string, stop: string): string[] {
  const out: string[] = []
  let dir = resolve(workspace)
  let depth = 0
  while (depth < 64) {
    out.push(join(dir, ".rokaru", "skills"))
    if (dir === stop) break
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
    depth += 1
  }
  return out.reverse()
}

// Discover every skill in one source root. A source may be a single loose .md
// file, or a directory holding either <name>/SKILL.md subdirectories or loose
// root-level .md files (each becomes a skill). Later entries win on collision.
function skillsFromSource(source: string): Map<string, Skill> {
  const skills = new Map<string, Skill>()
  if (!existsSync(source)) return skills
  let st: ReturnType<typeof statSync>
  try {
    st = statSync(source)
  } catch {
    return skills
  }
  if (st.isFile()) {
    if (source.toLowerCase().endsWith(".md")) {
      const id = basename(source).replace(/\.md$/i, "")
      const skill = makeSkill(source, id)
      if (skill) skills.set(id, skill)
    }
    return skills
  }
  let entries: Dirent[]
  try {
    entries = readdirSync(source, { withFileTypes: true })
  } catch {
    return skills
  }
  for (const entry of entries) {
    const full = join(source, entry.name)
    if (entry.isDirectory()) {
      const entryFile = join(full, "SKILL.md")
      if (existsSync(entryFile)) {
        const skill = makeSkill(entryFile, entry.name)
        if (skill) skills.set(skill.id, skill)
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      const id = entry.name.replace(/\.md$/i, "")
      const skill = makeSkill(full, id)
      if (skill) skills.set(id, skill)
    }
  }
  return skills
}

function makeSkill(file: string, id: string): Skill | undefined {
  let text: string
  try {
    text = readFileSync(file, "utf8").slice(0, 8_000)
  } catch {
    return undefined
  }
  const { name, description, hidden } = parseFrontmatter(text)
  return { id, name: name || id, description, root: dirname(file), file, hidden }
}

function mergeSkills(...sources: Map<string, Skill>[]): Map<string, Skill> {
  const merged = new Map<string, Skill>()
  for (const source of sources) for (const [id, skill] of source) merged.set(id, skill)
  return merged
}

// Discover skills across all configured + default sources. Precedence (lowest
// to highest): ~/.config/rokaru/skills, project .rokaru/skills (project root→
// cwd), then any extra `sources` from config. Later sources override earlier on
// id clash.
export function discoverSkills(config: SkillsConfig = {}, workspace = process.cwd()): Skill[] {
  const sources: string[] = [join(homedir(), ".config", "rokaru", "skills")]
  sources.push(...projectSourceDirs(workspace, projectRoot(workspace)))
  for (const extra of config.sources ?? []) sources.push(resolveSource(extra))
  const merged = mergeSkills(...sources.map((s) => skillsFromSource(s)))
  return [...merged.values()]
}

// Skills with a description that the model is allowed to invoke.
export function invocableSkills(skills: Skill[]): Skill[] {
  return skills.filter((skill) => !skill.hidden && skill.description.length > 0)
}

// Load a skill's body (frontmatter stripped) plus a sample of its files.
export function loadSkill(skill: Skill, includeFiles = true): LoadedSkill {
  let text = ""
  try {
    text = readFileSync(skill.file, "utf8")
  } catch {
    text = ""
  }
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim()
  if (!includeFiles) return { body, dir: skill.root, files: [] }

  const files: string[] = []
  try {
    const entries = readdirSync(skill.root, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name !== "SKILL.md") files.push(entry.name)
    }
  } catch {
    // ignore
  }
  files.sort()
  return { body, dir: skill.root, files: files.slice(0, MAX_SUPPORTING_FILES) }
}

// Permission evaluation. The last matching rule wins, mirroring opencode.
export function skillPermission(
  id: string,
  rules: { allow?: string[]; deny?: string[] } = {},
): "allow" | "ask" | "deny" {
  let outcome: "allow" | "ask" | "deny" = "ask"
  for (const pattern of rules.deny ?? []) if (matches(pattern, id)) outcome = "deny"
  for (const pattern of rules.allow ?? []) if (matches(pattern, id)) outcome = "allow"
  return outcome
}

function matches(pattern: string, id: string): boolean {
  if (pattern === "*") return true
  if (pattern === id) return true
  if (pattern.endsWith("*")) return id.startsWith(pattern.slice(0, -1))
  if (pattern.startsWith("*")) return id.endsWith(pattern.slice(1))
  return false
}
