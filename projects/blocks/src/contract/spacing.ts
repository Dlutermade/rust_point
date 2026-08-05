// 兩軸間距/內距(X 水平、Y 垂直)。相容舊的單一數值。
export interface Spacing {
  x: number
  y: number
}

export function toSpacing(v: unknown, def = 0): Spacing {
  if (typeof v === 'number') return { x: v, y: v }
  if (v && typeof v === 'object') {
    const o = v as { x?: number; y?: number }
    return { x: Number(o.x) || 0, y: Number(o.y) || 0 }
  }
  return { x: def, y: def }
}
