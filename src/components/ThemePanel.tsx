/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import {
  THEME_ROLE_LABELS,
  THEME_ROLES,
  activeThemeName,
  getTheme,
  sg,
  themeNames,
} from "../theme"
import { themeCustom, themeCustomRole, themeDraft, themeIndex } from "../store"

export function ThemePanel() {
  const names = () => themeNames()
  const newRow = () => names().length

  return (
    <box width="100%" height="100%" flexDirection="column" justifyContent="center" alignItems="center">
      <box
        flexDirection="column"
        width={64}
        border
        borderStyle="rounded"
        borderColor={getTheme().accent}
        backgroundColor={getTheme().panelBg}
        paddingLeft={1}
        paddingRight={1}
      >
        <Show when={!themeCustom()} fallback={<EditMode />}>
          <text fg={getTheme().accent}>
            <b>themes</b>
          </text>
          <text fg={getTheme().dim}>{""}</text>
          <For each={names()}>
            {(name, index) => (
              <text fg={themeIndex() === index() ? getTheme().good : getTheme().text}>
                <span {...sg(themeIndex() === index() ? getTheme().good : getTheme().text)}>
                  {`${themeIndex() === index() ? "▶ " : "  "}${name}`}
                </span>
                <span {...sg(getTheme().dim)}>{name === activeThemeName() ? "  ✓" : ""}</span>
              </text>
            )}
          </For>
          <text fg={themeIndex() === newRow() ? getTheme().good : getTheme().dim}>
            <span {...sg(getTheme().accent)}>{"＋ "}</span>
            <span {...sg(themeIndex() === newRow() ? getTheme().good : getTheme().dim)}>
              {"new theme  (build a custom palette)"}
            </span>
          </text>
          <text fg={getTheme().dim}>{""}</text>
          <text fg={getTheme().dim}>↑/↓ choose · enter apply · esc close</text>
        </Show>
      </box>
    </box>
  )
}

function EditMode() {
  return (
    <Show when={themeDraft()}>
      {(draft) => (
        <>
          <text fg={getTheme().accent}>
            <b>new theme</b>
          </text>
          <text fg={getTheme().dim}>←/→ changes the colour · enter saves</text>
          <text fg={getTheme().dim}>{""}</text>
          <For each={THEME_ROLES}>
            {(role, index) => (
              <text fg={themeCustomRole() === index() ? getTheme().good : getTheme().dim}>
                <span {...sg(themeCustomRole() === index() ? getTheme().good : getTheme().dim)}>
                  {`${themeCustomRole() === index() ? "▶ " : "  "}${(THEME_ROLE_LABELS[role] ?? role).padEnd(14)}`}
                </span>
                <span {...sg(draft()[role])}>{`${draft()[role]}  ██`}</span>
              </text>
            )}
          </For>
          <text fg={getTheme().dim}>{""}</text>
          <text fg={getTheme().dim}>↑/↓ role · ←/→ colour · enter save · esc cancel</text>
        </>
      )}
    </Show>
  )
}
