/** @jsxImportSource @opentui/solid */
import { createSignal, onMount } from "solid-js"
import { listModels, type ModelInfo } from "../omlx"
import { friendlyError } from "../errors"
import { ModelPicker } from "./ModelPicker"
import * as store from "../store"

export function SwitchModel(props: {
  baseURL: string
  apiKey: string
  onSelect: (model: ModelInfo) => void
}) {
  const [error, setError] = createSignal("")

  onMount(() => {
    void (async () => {
      try {
        const fresh = await listModels({ baseURL: props.baseURL, apiKey: props.apiKey })
        if (fresh.length > 0) store.setModels(fresh)
      } catch (err) {
        // Keep the previously known list; just note we couldn't refresh.
        setError(friendlyError(err, { baseURL: props.baseURL }))
      }
    })()
  })

  return (
    <box width="100%" height="100%" flexDirection="column" justifyContent="center" alignItems="center">
      <ModelPicker
        models={store.models()}
        title="switch model"
        current={store.model()}
        error={error()}
        onSelect={props.onSelect}
      />
    </box>
  )
}
