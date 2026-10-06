import { SyntaxStyle } from "@opentui/core"
import { getTheme, themeVersion } from "./theme"

// Built once per theme, lazily (after the renderer/native lib is up), and
// reused by every markdown block on screen. Scopes break text up by meaning:
// headings/numbers/emphasis read as amber, inline code as green, links blue.
let style: SyntaxStyle | undefined
let version = -1

export function markdownStyle(): SyntaxStyle {
  const v = themeVersion()
  if (v === version && style) return style
  version = v
  style = SyntaxStyle.fromStyles({
    default: { fg: getTheme().body },
    conceal: { fg: getTheme().dim },
    text: { fg: getTheme().body },
    "markup.heading": { fg: getTheme().accent, bold: true },
    "markup.heading.1": { fg: getTheme().accent, bold: true },
    "markup.heading.2": { fg: getTheme().accent, bold: true },
    "markup.heading.3": { fg: getTheme().warn, bold: true },
    "markup.bold": { fg: getTheme().warn, bold: true },
    "markup.strong": { fg: getTheme().warn, bold: true },
    "markup.italic": { fg: getTheme().body, italic: true },
    "markup.strikethrough": { fg: getTheme().dim },
    "markup.quote": { fg: getTheme().dim, italic: true },
    "markup.raw": { fg: getTheme().good },
    "markup.raw.inline": { fg: getTheme().good },
    "markup.raw.block": { fg: "#9aa7bd" },
    "markup.list": { fg: getTheme().blue },
    "markup.link": { fg: getTheme().blue, underline: true },
    "markup.link.label": { fg: getTheme().blue, underline: true },
    "markup.link.url": { fg: getTheme().dim, dim: true },
    string: { fg: "#c792ea" },
    keyword: { fg: getTheme().blue },
    comment: { fg: getTheme().dim, italic: true },
    number: { fg: getTheme().warn },
    "constant.numeric": { fg: getTheme().warn },
  })
  return style
}
