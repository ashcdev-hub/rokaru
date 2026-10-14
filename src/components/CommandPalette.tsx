/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
import { paletteIndex } from "../store"

export interface PaletteAction {
  label: string
  description: string
  category?: string
  shortcut?: string
}

export function filterPaletteActions<T extends PaletteAction>(actions: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return actions
  return actions.filter((action) =>
    `${action.label.replace(/^\//, "")} ${action.description} ${action.category ?? ""}`.toLowerCase().includes(q),
  )
}

function groupActions(actions: PaletteAction[]): { category: string; items: { action: PaletteAction; index: number }[] }[] {
  const groups: { category: string; items: { action: PaletteAction; index: number }[] }[] = []
  actions.forEach((action, index) => {
    const category = action.category ?? ""
    let group = groups.find((entry) => entry.category === category)
    if (!group) {
      group = { category, items: [] }
      groups.push(group)
    }
    group.items.push({ action, index })
  })
  return groups
}

export function CommandPalette(props: { actions: PaletteAction[]; query: string; onPick: (index: number) => void }) {
  return (
    <box width="100%" height="100%" flexDirection="column" justifyContent="center" alignItems="center">
      <box
        flexDirection="column"
        width={72}
        border
        borderStyle="rounded"
        borderColor={getTheme().accent}
        backgroundColor={getTheme().panelBg}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={getTheme().accent}>
          <b>commands</b>
        </text>
        <text>
          <span {...sg(getTheme().text)}>{`> ${props.query}`}</span>
          <span {...sg(getTheme().dim)}>▌</span>
        </text>
        <Show when={props.actions.length > 0} fallback={<text fg={getTheme().dim}>(no matches)</text>}>
          <For each={groupActions(props.actions)}>
            {(group) => (
              <>
                <Show when={group.category.length > 0}>
                  <text fg={getTheme().meter}>{group.category}</text>
                </Show>
                <For each={group.items}>
                  {(item) => (
                    <text fg={paletteIndex() === item.index ? getTheme().good : getTheme().dim}>
                      <span {...sg(paletteIndex() === item.index ? getTheme().good : getTheme().dim)}>
                        {`${paletteIndex() === item.index ? "▶ " : "  "}${item.action.label}`}
                      </span>
                      <span {...sg(getTheme().dim)}>{`  ${item.action.description}`}</span>
                      <Show when={item.action.shortcut}>
                        <span {...sg(getTheme().blue)}>{`  [${item.action.shortcut}]`}</span>
                      </Show>
                    </text>
                  )}
                </For>
              </>
            )}
          </For>
        </Show>
        <text fg={getTheme().dim}>{""}</text>
        <text fg={getTheme().dim}>type to filter · ↑/↓ choose · enter run · esc close</text>
      </box>
    </box>
  )
}
