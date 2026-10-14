/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { getTheme, sg } from "../theme"
import type { ModelInfo } from "../omlx"
import { formatCompact } from "../metrics"
import { filterModels } from "../modelFilter"
import { windowStart } from "../listWindow"
import { pickerIndex, pickerQuery } from "../store"

const VISIBLE_MODELS = 8

// A filterable model picker card, shared by the startup screen and /model.
export function ModelPicker(props: {
  models: ModelInfo[]
  onSelect: (model: ModelInfo) => void
  title?: string
  current?: string
  error?: string
}) {
  const list = () => filterModels(props.models, pickerQuery())
  const index = () => Math.min(pickerIndex(), Math.max(0, list().length - 1))
  const start = () => windowStart(index(), list().length, VISIBLE_MODELS)
  const visible = () => list().slice(start(), start() + VISIBLE_MODELS)
  const moreAbove = () => start()
  const moreBelow = () => Math.max(0, list().length - (start() + VISIBLE_MODELS))

  return (
    <box flexDirection="column" alignItems="center">
      <box
        flexDirection="column"
        width={68}
        border
        borderStyle="rounded"
        borderColor={getTheme().accent}
        backgroundColor={getTheme().panelBg}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={getTheme().accent}>
          <b>{props.title ?? "choose a model"}</b>
        </text>
        <text fg={getTheme().dim}>oMLX must already be running</text>
        <text>
          <span {...sg(getTheme().dim)}>{"search: "}</span>
          <span {...sg(getTheme().text)}>{pickerQuery()}</span>
          <span {...sg(getTheme().accent)}>▌</span>
        </text>
        <Show when={list().length > 0} fallback={<text fg={getTheme().warn}>(no models match)</text>}>
          <Show when={moreAbove() > 0}>
            <text fg={getTheme().dim}>{`  ↑ ${moreAbove()} more`}</text>
          </Show>
          <For each={visible()}>
            {(model, offset) => {
              const row = () => start() + offset()
              const selected = () => index() === row()
              return (
                <text fg={selected() ? getTheme().good : getTheme().text}>
                  <span {...sg(selected() ? getTheme().good : getTheme().dim)}>{selected() ? "▶ " : "  "}</span>
                  <span {...sg(getTheme().text)}>{model.id}</span>
                  <span {...sg(getTheme().dim)}>{`  ${formatCompact(model.maxModelLen)}`}</span>
                  <Show when={model.id === props.current}>
                    <span {...sg(getTheme().good)}>{"  ✓"}</span>
                  </Show>
                </text>
              )
            }}
          </For>
          <Show when={moreBelow() > 0}>
            <text fg={getTheme().dim}>{`  ↓ ${moreBelow()} more`}</text>
          </Show>
        </Show>
        <Show when={props.error}>
          <text fg={getTheme().warn}>{props.error}</text>
        </Show>
        <text fg={getTheme().dim}>type to filter · ↑/↓ select · enter confirm · esc cancel</text>
      </box>
    </box>
  )
}
