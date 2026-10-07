export interface DiffLine {
  kind: "add" | "del" | "ctx"
  text: string
  oldLine?: number
  newLine?: number
}

const MAX_CELLS = 2_000_000
const CONTEXT = 2
const MAX_OUTPUT_LINES = 400

type Op = DiffLine

function naive(a: string[], b: string[]): Op[] {
  return [
    ...a.map((text, i) => ({ kind: "del" as const, text, oldLine: i + 1 })),
    ...b.map((text, i) => ({ kind: "add" as const, text, newLine: i + 1 })),
  ]
}

function lcsOps(a: string[], b: string[]): Op[] {
  const n = a.length
  const m = b.length
  if (n === 0) return b.map((text, j) => ({ kind: "add", text, newLine: j + 1 }))
  if (m === 0) return a.map((text, i) => ({ kind: "del", text, oldLine: i + 1 }))
  if (n * m > MAX_CELLS) return naive(a, b)

  const dp = new Uint32Array((n + 1) * (m + 1))
  const idx = (i: number, j: number) => i * (m + 1) + j
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[idx(i, j)] = a[i] === b[j] ? dp[idx(i + 1, j + 1)] + 1 : Math.max(dp[idx(i + 1, j)], dp[idx(i, j + 1)])
    }
  }

  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: "ctx", text: a[i], oldLine: i + 1, newLine: j + 1 })
      i++
      j++
    } else if (dp[idx(i + 1, j)] >= dp[idx(i, j + 1)]) {
      ops.push({ kind: "del", text: a[i], oldLine: i + 1 })
      i++
    } else {
      ops.push({ kind: "add", text: b[j], newLine: j + 1 })
      j++
    }
  }
  while (i < n) ops.push({ kind: "del", text: a[i], oldLine: i + 1 }), i++
  while (j < m) ops.push({ kind: "add", text: b[j], newLine: j + 1 }), j++
  return ops
}

// Trim a full op list down to hunks with a little surrounding context.
function hunks(ops: Op[]): DiffLine[] {
  const keep = new Set<number>()
  ops.forEach((op, index) => {
    if (op.kind === "ctx") return
    for (let k = index - CONTEXT; k <= index + CONTEXT; k++) {
      if (k >= 0 && k < ops.length) keep.add(k)
    }
  })
  const out: DiffLine[] = []
  let lastIndex = -1
  for (let index = 0; index < ops.length; index++) {
    if (!keep.has(index)) continue
    if (lastIndex !== -1 && index > lastIndex + 1) out.push({ kind: "ctx", text: "⋯" })
    out.push(ops[index])
    lastIndex = index
    if (out.length >= MAX_OUTPUT_LINES) {
      out.push({ kind: "ctx", text: "… (diff truncated)" })
      break
    }
  }
  return out
}

export function diffLines(oldText: string, newText: string): DiffLine[] {
  if (oldText === newText) return []
  if (oldText.length === 0) return newText.split("\n").map((text, i) => ({ kind: "add" as const, text, newLine: i + 1 }))
  return hunks(lcsOps(oldText.split("\n"), newText.split("\n")))
}
