import type { ModelInfo } from "./omlx"

// Case-insensitive substring filter over model ids. Pure so it can be tested.
export function filterModels(models: ModelInfo[], query: string): ModelInfo[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return models
  return models.filter((model) => model.id.toLowerCase().includes(q))
}
