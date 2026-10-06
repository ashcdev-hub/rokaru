import { isAbsolute, resolve } from "node:path"
import { imageDataUrl } from "../image"
import { isSensitivePath } from "../sensitive"
import type { ToolDef } from "./types"

export const viewImageTool: ToolDef = {
  name: "view_image",
  description:
    "Load an image file so you can see it (png/jpg/jpeg/gif/webp/bmp). Use this for screenshots, photos, diagrams and UI mockups.",
  destructive: false,
  parameters: {
    type: "object",
    properties: { path: { type: "string", description: "Image file path" } },
    required: ["path"],
  },
  async run(args, ctx) {
    const input = String(args?.path ?? "")
    const target = isAbsolute(input) ? input : resolve(ctx.workspace, input)
    if (isSensitivePath(target)) throw new Error(`refused: ${target} is in a protected location`)
    const { dataUrl, bytes } = imageDataUrl(target)
    ctx.onImage?.(dataUrl)
    return `loaded image ${target} (${Math.round(bytes / 1024)} KB) — it is attached for you to view now`
  },
}
