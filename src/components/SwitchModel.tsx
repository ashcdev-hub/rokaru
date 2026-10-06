/** @jsxImportSource @opentui/solid */
import { createSignal, onMount, Show } from "solid-js"
import { getTheme } from "../theme"
import { listModels, type ModelInfo } from "../omlx"
import { formatCompact } from "../metrics"
import * as store from "../store"

export function SwitchModel(props: {
  baseURL: string
  apiKey: string
  onSelect: (model: ModelInfo) => void
}) {
  const [models, setModels] = createSignal<ModelInfo[]>(store.models())
  const [error, setError] = createSignal("")

  onMount(() => {
    void (async () => {
      try {
        const fresh = await listModels({ baseURL: props.baseURL, apiKey: props.apiKey })
        if (fresh.length > 0) {
          setModels(fresh)
          store.setModels(fresh)
        }
      } catch (err) {
        // Keep the previously known list; just note we couldn't refresh.
        setError(`could not refresh from oMLX: ${(err as Error).message}`)
      }
    })()
  })

  return (
    <box width="100%" height="100%" flexDirection="column" justifyContent="center" alignItems="center">
      <box flexDirection="column" alignItems="center">
        <text fg={getTheme().accent}>
          <b>switch model</b>
        </text>
        <text fg={getTheme().dim}>{`current: ${store.model() || "none"}`}</text>
        <text fg={getTheme().text}>{""}</text>
        <Show
          when={models().length > 0}
          fallback={<text fg={getTheme().dim}>loading models…</text>}
        >
          <select
            focused={true}
            width={64}
            height={Math.min(models().length * 2 + 1, 12)}
            options={models().map((m) => ({
              name: m.id,
              description: `context ${formatCompact(m.maxModelLen)}`,
              value: m.id,
            }))}
            onSelect={(index: number, option: any) => {
              const chosen = models().find((m) => m.id === (option?.value ?? m.id)) ?? models()[index]
              if (chosen) props.onSelect(chosen)
            }}
          />
        </Show>
        <text fg={getTheme().text}>{""}</text>
        <Show when={error().length > 0}>
          <text fg={getTheme().warn}>{error()}</text>
        </Show>
        <text fg={getTheme().dim}>↑/↓ select · enter confirm · esc cancel</text>
      </box>
    </box>
  )
}
