import { readFileSync, statSync } from "node:fs"
import { extname } from "node:path"

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
}

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024

export function mimeFor(path: string): string | undefined {
  return IMAGE_MIME[extname(path).toLowerCase()]
}

export function imageDataUrl(path: string): { dataUrl: string; mime: string; bytes: number } {
  const mime = mimeFor(path)
  if (!mime) throw new Error(`unsupported image type: ${path} (png/jpg/jpeg/gif/webp/bmp)`)
  const stat = statSync(path)
  if (stat.size > MAX_IMAGE_BYTES) {
    throw new Error(`image too large: ${Math.round(stat.size / 1024)} KB (max ${MAX_IMAGE_BYTES / 1024 / 1024} MB)`)
  }
  const base64 = readFileSync(path).toString("base64")
  return { dataUrl: `data:${mime};base64,${base64}`, mime, bytes: stat.size }
}
