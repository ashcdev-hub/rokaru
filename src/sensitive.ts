import { realpathSync } from "node:fs"
import { homedir } from "node:os"
import { resolve, sep } from "node:path"

const HOME = homedir()

// Directories the tools may never read from, and files the tools may never
// read. Blocking the network stops exfiltration, but this stops the model
// pulling secrets into the (local) transcript in the first place.
export const SENSITIVE_DIRS: string[] = [
  `${HOME}/.ssh`,
  `${HOME}/.aws`,
  `${HOME}/.gnupg`,
  `${HOME}/.config/gh`,
  `${HOME}/.docker`,
  `${HOME}/.kube`,
  `${HOME}/.omlx`,
  `${HOME}/Library/Keychains`,
  `${HOME}/Library/Cookies`,
  `${HOME}/Library/Safari`,
  `${HOME}/Library/Application Support/Google/Chrome`,
  `${HOME}/Library/Application Support/Firefox`,
].map((p) => resolve(p))

export const SENSITIVE_FILES: string[] = [
  `${HOME}/.netrc`,
  `${HOME}/.npmrc`,
  `${HOME}/.pypirc`,
  `${HOME}/.zsh_history`,
  `${HOME}/.bash_history`,
  `${HOME}/.zhistory`,
].map((p) => resolve(p))

function canonical(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return resolve(path)
  }
}

export function isSensitivePath(path: string): boolean {
  const candidate = canonical(path)
  for (const dir of SENSITIVE_DIRS) {
    const root = canonical(dir)
    if (candidate === root || candidate.startsWith(root + sep)) return true
  }
  for (const file of SENSITIVE_FILES) {
    if (candidate === canonical(file)) return true
  }
  return false
}
