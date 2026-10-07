// Keep the mounted transcript to a recent window so very long sessions stay
// smooth. Pure so it can be unit-tested.

export interface TranscriptWindow<T> {
  // How many leading items are not mounted.
  hidden: number
  list: T[]
}

export function transcriptWindow<T>(list: T[], renderWindow: number, expandAll: boolean): TranscriptWindow<T> {
  if (expandAll || renderWindow <= 0 || list.length <= renderWindow) return { hidden: 0, list }
  return { hidden: list.length - renderWindow, list: list.slice(-renderWindow) }
}
