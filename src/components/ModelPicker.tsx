/** @jsxImportSource @opentui/solid */
import { For } from "solid-js"
import { THEME, sg } from "../theme"
import type { ModelInfo } from "../omlx"
import { formatCompact } from "../metrics"

export function ModelPicker(props: { models: ModelInfo[]; onSelect: (model: ModelInfo) => void; width?: number }) {
  const width = () => props.width ?? 60
  return (
    <box flexDirection="column" alignItems="center">
      <text fg={THEME.text}>choose a model (oMLX must already be running):</text>
      <text fg={THEME.text}>{""}</text>
      <select
        focused={true}
        width={width()}
        height={Math.min(props.models.length * 2 + 1, 12)}
        options={props.models.map((m) => ({
          name: m.id,
          description: `context ${formatCompact(m.maxModelLen)}`,
          value: m.id,
        }))}
        onSelect={(index: number, option: any) => {
          const chosen = props.models.find((m) => m.id === (option?.value ?? m.id)) ?? props.models[index]
          if (chosen) props.onSelect(chosen)
        }}
      />
      <text fg={THEME.text}>{""}</text>
      <text fg={THEME.dim}>↑/↓ select · enter confirm</text>
    </box>
  )
}

export function ModelList(props: { models: ModelInfo[] }) {
  return (
    <For each={props.models}>
      {(m) => (
        <text fg={THEME.dim}>
          <span {...sg(THEME.blue)}>{m.id}</span>
          <span {...sg(THEME.dim)}>{`  ${formatCompact(m.maxModelLen)}`}</span>
        </text>
      )}
    </For>
  )
}
