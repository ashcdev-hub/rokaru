import { SyntaxStyle } from "@opentui/core"
import { THEME } from "./theme"

// Built once, lazily (after the renderer/native lib is up), and reused by every
// markdown block on screen.
let style: SyntaxStyle | undefined

export function markdownStyle(): SyntaxStyle {
  if (style) return style
  style = SyntaxStyle.fromStyles({
    default: { fg: THEME.text },
    conceal: { fg: THEME.dim },
    "markup.heading": { fg: THEME.warn, bold: true },
    "markup.heading.1": { fg: THEME.warn, bold: true },
    "markup.heading.2": { fg: THEME.warn, bold: true },
    "markup.heading.3": { fg: THEME.accent, bold: true },
    "markup.bold": { fg: THEME.text, bold: true },
    "markup.strong": { fg: THEME.text, bold: true },
    "markup.italic": { fg: THEME.text, italic: true },
    "markup.raw": { fg: THEME.good },
    "markup.raw.block": { fg: "#9aa7bd" },
    "markup.list": { fg: THEME.blue },
    "markup.link": { fg: THEME.blue, underline: true },
    "markup.link.label": { fg: THEME.blue, underline: true },
    "markup.link.url": { fg: THEME.dim, dim: true },
    string: { fg: "#c792ea" },
    keyword: { fg: THEME.blue },
    comment: { fg: THEME.dim, italic: true },
    number: { fg: THEME.accent },
  })
  return style
}
