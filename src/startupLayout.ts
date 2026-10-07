// Layout math for the start screen, kept separate from the components so it can
// be unit-tested.

// Approximate row count of the centred content block. The model picker grows
// with the model list (capped at 12 rows) which is why the block can outgrow a
// fixed rain-clearance band as more models are added.
export function startupContentRows(modelCount: number, logoRows: number, picking: boolean): number {
  const pickerHeight = Math.min(modelCount * 2 + 1, 12)
  return logoRows + 7 + (picking ? pickerHeight + 4 : 1)
}

export function startupContentCols(logoWidth: number): number {
  return Math.max(60, logoWidth)
}

export function centreHalfExtents(clearRows: number, clearCols: number): { halfWidth: number; halfHeight: number } {
  // A small margin so rounding never leaves the content edge exposed.
  return { halfWidth: clearCols / 2 + 2, halfHeight: clearRows / 2 + 1.5 }
}

// True when (x, y) falls inside the rectangle the rain must not draw in.
export function isClearedByCentre(
  x: number,
  y: number,
  width: number,
  height: number,
  clearRows: number,
  clearCols: number,
): boolean {
  const { halfWidth, halfHeight } = centreHalfExtents(clearRows, clearCols)
  return Math.abs(x - width / 2) < halfWidth && Math.abs(y - height / 2) < halfHeight
}
