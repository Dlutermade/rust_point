import type { BlockInstance } from '../../service/storefront/shared/types'

// 區塊樹操作(遞迴,支援 container 巢狀)。

export function findNode(nodes: BlockInstance[], id: string): BlockInstance | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) {
      const f = findNode(n.children, id)
      if (f) return f
    }
  }
  return null
}

export function removeNode(nodes: BlockInstance[], id: string): BlockInstance | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) {
      const [x] = nodes.splice(i, 1)
      return x
    }
    const kids = nodes[i].children
    if (kids) {
      const r = removeNode(kids, id)
      if (r) return r
    }
  }
  return null
}

// position: -1 = 放在 anchor 之前,其他 = 之後。
export function insertRelative(
  nodes: BlockInstance[],
  anchorId: string,
  item: BlockInstance,
  position: number,
): boolean {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === anchorId) {
      nodes.splice(position === -1 ? i : i + 1, 0, item)
      return true
    }
    const kids = nodes[i].children
    if (kids && insertRelative(kids, anchorId, item, position)) return true
  }
  return false
}

export function insertAfter(
  nodes: BlockInstance[],
  anchorId: string,
  item: BlockInstance,
): boolean {
  return insertRelative(nodes, anchorId, item, 1)
}

// 遞迴 patch 某節點的任意欄位(data / size …)。
export function updateNode(
  nodes: BlockInstance[],
  id: string,
  patch: Partial<BlockInstance>,
): BlockInstance[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, ...patch }
    if (n.children) return { ...n, children: updateNode(n.children, id, patch) }
    return n
  })
}

export function cloneWithNewIds(node: BlockInstance): BlockInstance {
  return {
    id: crypto.randomUUID().slice(0, 8),
    type: node.type,
    data: structuredClone(node.data),
    // 尺寸 / 位置 / 顯示裝置都要跟著複製 —— 少帶任何一個,複本在畫布上就會長得不一樣。
    size: node.size ? structuredClone(node.size) : undefined,
    pos: node.pos ? structuredClone(node.pos) : undefined,
    visibility: node.visibility,
    name: node.name,
    children: node.children?.map(cloneWithNewIds),
  }
}

// ── 不可變操作(結構共享)──────────────────────────
// 未變動的節點保留原參照 → 讓 memo(BlockView) 生效,新增/刪除只重繪變動的子樹。

export function insertChild(
  nodes: BlockInstance[],
  parentId: string,
  item: BlockInstance,
): BlockInstance[] {
  let changed = false
  const out = nodes.map((n) => {
    if (n.id === parentId) {
      changed = true
      return { ...n, children: [...(n.children ?? []), item] }
    }
    if (n.children) {
      const c = insertChild(n.children, parentId, item)
      if (c !== n.children) {
        changed = true
        return { ...n, children: c }
      }
    }
    return n
  })
  return changed ? out : nodes
}

export function removeById(nodes: BlockInstance[], id: string): BlockInstance[] {
  let changed = false
  const out: BlockInstance[] = []
  for (const n of nodes) {
    if (n.id === id) {
      changed = true
      continue
    }
    if (n.children) {
      const c = removeById(n.children, id)
      if (c !== n.children) {
        changed = true
        out.push({ ...n, children: c })
        continue
      }
    }
    out.push(n)
  }
  return changed ? out : nodes
}

// position: -1 = 放在 anchor 前;其他 = 後。
export function insertRelativeImm(
  nodes: BlockInstance[],
  anchorId: string,
  item: BlockInstance,
  position: number,
): BlockInstance[] {
  const idx = nodes.findIndex((n) => n.id === anchorId)
  if (idx >= 0) {
    const out = nodes.slice()
    out.splice(position === -1 ? idx : idx + 1, 0, item)
    return out
  }
  let changed = false
  const out = nodes.map((n) => {
    if (n.children) {
      const c = insertRelativeImm(n.children, anchorId, item, position)
      if (c !== n.children) {
        changed = true
        return { ...n, children: c }
      }
    }
    return n
  })
  return changed ? out : nodes
}

export function insertAfterImm(
  nodes: BlockInstance[],
  anchorId: string,
  item: BlockInstance,
): BlockInstance[] {
  return insertRelativeImm(nodes, anchorId, item, 1)
}

// target 是否在 node 的子孫裡(避免把節點拖進自己的子樹)。
export function checkIsDescendant(node: BlockInstance, targetId: string): boolean {
  if (!node.children) return false
  for (const c of node.children) {
    if (c.id === targetId || checkIsDescendant(c, targetId)) return true
  }
  return false
}

// 在同層兄弟間移動一格(dir -1 上移 / +1 下移);到邊界或找不到回原參照。
export function moveSibling(nodes: BlockInstance[], id: string, dir: -1 | 1): BlockInstance[] {
  const idx = nodes.findIndex((n) => n.id === id)
  if (idx >= 0) {
    const j = idx + dir
    if (j < 0 || j >= nodes.length) return nodes
    const out = nodes.slice()
    ;[out[idx], out[j]] = [out[j], out[idx]]
    return out
  }
  let changed = false
  const out = nodes.map((n) => {
    if (n.children) {
      const c = moveSibling(n.children, id, dir)
      if (c !== n.children) {
        changed = true
        return { ...n, children: c }
      }
    }
    return n
  })
  return changed ? out : nodes
}

// 把 id 移到同層 beforeId 之前(beforeId=null → 移到該層最後)。以「插在誰前面」表達,免索引位移錯。
export function moveBefore(
  nodes: BlockInstance[],
  id: string,
  beforeId: string | null,
): BlockInstance[] {
  const idx = nodes.findIndex((n) => n.id === id)
  if (idx >= 0) {
    const out = nodes.slice()
    const [item] = out.splice(idx, 1)
    if (beforeId == null) {
      out.push(item)
      return out
    }
    const bi = out.findIndex((n) => n.id === beforeId)
    out.splice(bi < 0 ? out.length : bi, 0, item)
    return out
  }
  let changed = false
  const out = nodes.map((n) => {
    if (n.children) {
      const c = moveBefore(n.children, id, beforeId)
      if (c !== n.children) {
        changed = true
        return { ...n, children: c }
      }
    }
    return n
  })
  return changed ? out : nodes
}

// 找某節點的父節點(root 層的節點回 null)。
export function findParent(nodes: BlockInstance[], id: string): BlockInstance | null {
  for (const n of nodes) {
    if (n.children) {
      if (n.children.some((c) => c.id === id)) return n
      const deeper = findParent(n.children, id)
      if (deeper) return deeper
    }
  }
  return null
}

export function allIds(nodes: BlockInstance[]): string[] {
  const out: string[] = []
  const walk = (arr: BlockInstance[]) => {
    for (const n of arr) {
      out.push(n.id)
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return out
}
