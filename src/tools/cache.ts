import { statSync } from "node:fs"

const MAX_ENTRIES = 100

class FileCache {
  private cache = new Map<string, { mtime: number; content: string }>()

  private touch(key: string): void {
    const entry = this.cache.get(key)
    if (entry) {
      this.cache.delete(key)
      this.cache.set(key, entry)
    }
  }

  get(path: string): string | null {
    const entry = this.cache.get(path)
    if (!entry) return null
    try {
      if (statSync(path).mtimeMs !== entry.mtime) {
        this.cache.delete(path)
        return null
      }
    } catch {
      this.cache.delete(path)
      return null
    }
    this.touch(path)
    return entry.content
  }

  set(path: string, content: string): void {
    this.touch(path)
    if (!this.cache.has(path)) {
      if (this.cache.size >= MAX_ENTRIES) {
        const firstKey = this.cache.keys().next().value
        if (firstKey !== undefined) this.cache.delete(firstKey)
      }
    }
    try {
      this.cache.set(path, { mtime: statSync(path).mtimeMs, content })
    } catch {
      this.cache.set(path, { mtime: 0, content })
    }
  }

  clearFor(path: string): void {
    this.cache.delete(path)
  }

  clear(): void {
    this.cache.clear()
  }
}

export const fileCache = new FileCache()
