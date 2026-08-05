import { arrayMove } from '@dnd-kit/sortable'
import { blockTypeMap } from '@sc/blocks'
import type { BlockInstance, BlockSize, Pos9 } from '../../api/types'

// dnd-kit 版巢狀樹的核心:攤平 → 拖動時投影出目標深度/父層 → 放開後重建樹。
// 參考 dnd-kit 官方 sortable-tree 範例,依本專案「只有容器能當父」調整。

export const INDENT_WIDTH = 18

export interface FlatBlock {
  id: string
  type: string
  data: Record<string, unknown>
  size?: BlockSize
  pos?: Pos9
  name?: string
  isContainer: boolean
  hasChildren: boolean
  depth: number
  parentId: string | null
  index: number
}

export function flattenBlocks(
  nodes: BlockInstance[],
  parentId: string | null = null,
  depth = 0,
): FlatBlock[] {
  const out: FlatBlock[] = []
  nodes.forEach((n, index) => {
    out.push({
      id: n.id,
      type: n.type,
      data: n.data,
      size: n.size,
      pos: n.pos,
      name: n.name,
      isContainer: !!blockTypeMap[n.type]?.container,
      hasChildren: !!(n.children && n.children.length),
      depth,
      parentId,
      index,
    })
    if (n.children && n.children.length) out.push(...flattenBlocks(n.children, n.id, depth + 1))
  })
  return out
}

// 拖動 / 收合時,把某些節點的子孫從「渲染清單」拿掉(子孫跟著父一起動 / 收合)。
export function removeChildrenOf(items: FlatBlock[], ids: string[]): FlatBlock[] {
  const exclude = new Set(ids)
  return items.filter((item) => {
    if (item.parentId && exclude.has(item.parentId)) {
      if (item.hasChildren) exclude.add(item.id)
      return false
    }
    return true
  })
}

// 由攤平清單(含 parentId)重建區塊樹;靠 parentId 對應,不依賴父在子之前。
export function buildTree(flat: FlatBlock[]): BlockInstance[] {
  const byId: Record<string, BlockInstance> = {}
  for (const f of flat) {
    const node: BlockInstance = { id: f.id, type: f.type, data: f.data }
    if (f.size) node.size = f.size
    if (f.pos) node.pos = f.pos
    if (f.name) node.name = f.name
    byId[f.id] = node
  }
  const roots: BlockInstance[] = []
  for (const f of flat) {
    const node = byId[f.id]
    const parent = f.parentId ? byId[f.parentId] : null
    if (parent) {
      parent.children = parent.children ?? []
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

// 拖放的「搬移意圖」(結構性、與 data 無關):把 activeId 搬到 overId 位置,新深度/父層如下。
// 由 BlockList 產出、BlockTreeEditor 套用到它「當下」的 blocks —— 樹本身不從(可能過期的)prop 重建。
export interface ReorderMove {
  activeId: string
  overId: string
  depth: number
  parentId: string | null
}

// 把搬移意圖套到給定的 blocks 上(單一來源:呼叫者傳入當下最新的 blocks)。
export function applyReorder(blocks: BlockInstance[], move: ReorderMove): BlockInstance[] {
  const flat = flattenBlocks(blocks)
  const aIdx = flat.findIndex((i) => i.id === move.activeId)
  const oIdx = flat.findIndex((i) => i.id === move.overId)
  if (aIdx < 0 || oIdx < 0) return blocks
  flat[aIdx] = { ...flat[aIdx], depth: move.depth, parentId: move.parentId }
  return buildTree(arrayMove(flat, aIdx, oIdx))
}

// 只有容器能再深一層;非容器(標題/文字…)不能當別人的父。
function getMaxDepth(previous: FlatBlock | undefined): number {
  if (!previous) return 0
  return previous.isContainer ? previous.depth + 1 : previous.depth
}

export interface Projection {
  depth: number
  parentId: string | null
}

// 依「拖動的水平位移」投影出放開後的深度與父層(往右縮排進容器、往左退出)。
export function getProjection(
  items: FlatBlock[],
  activeId: string,
  overId: string,
  dragOffset: number,
): Projection {
  const overIndex = items.findIndex((i) => i.id === overId)
  const activeIndex = items.findIndex((i) => i.id === activeId)
  if (overIndex < 0 || activeIndex < 0) return { depth: 0, parentId: null }
  const newItems = arrayMove(items, activeIndex, overIndex)
  const previous = newItems[overIndex - 1]
  const next = newItems[overIndex + 1]
  const dragDepth = Math.round(dragOffset / INDENT_WIDTH)
  // 基準深度 = 前一項的深度(位置感知,兩邊都自然):
  //  - 拖到容器子項之間 → 前一項是子項(深)→ 自動巢狀進去(好放進)
  //  - 拖到頂層容器下方 → 前一項是該容器(depth 0)→ 停在最上層(好移出)
  // 要微調再左右拖(往右進一層 / 往左退一層);上下界由 max/minDepth 夾住。
  const base = previous ? previous.depth : 0
  const projected = base + dragDepth
  const maxDepth = getMaxDepth(previous)
  const minDepth = next ? next.depth : 0
  let depth = projected
  if (depth > maxDepth) depth = maxDepth
  else if (depth < minDepth) depth = minDepth

  const parentId = (() => {
    if (depth === 0 || !previous) return null
    if (depth === previous.depth) return previous.parentId
    if (depth > previous.depth) return previous.id
    const ancestor = newItems
      .slice(0, overIndex)
      .reverse()
      .find((i) => i.depth === depth)
    return ancestor?.parentId ?? null
  })()

  return { depth, parentId }
}
