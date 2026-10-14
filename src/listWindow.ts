// Keep a long list to a fixed number of visible rows, centred on the current
// selection. Pure so it can be unit-tested.
export function windowStart(index: number, total: number, size: number): number {
  if (size <= 0 || total <= size) return 0
  const half = Math.floor(size / 2)
  return Math.max(0, Math.min(index - half, total - size))
}
