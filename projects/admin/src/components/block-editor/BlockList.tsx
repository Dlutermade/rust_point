import { memo, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragMoveEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS as DndCSS } from '@dnd-kit/utilities'
import { Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  AlignLeftOutlined,
  BorderOutlined,
  BuildOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FontSizeOutlined,
  LayoutOutlined,
  LineOutlined,
  PictureOutlined,
  StarOutlined,
  VerticalAlignMiddleOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'
import { ICON_LABELS, blockTypeMap, blockTypes } from '@sc/blocks'
import type { IconName } from '@sc/blocks'
import type { BlockInstance } from '../../api/types'
import { INDENT_WIDTH, flattenBlocks, getProjection, removeChildrenOf } from './dnd-tree'
import type { FlatBlock, ReorderMove } from './dnd-tree'

// 後台面板圖示(用 antd icons — 前台 WC 才禁用)。
const PALETTE_ICONS: Record<string, ReactNode> = {
  container: <LayoutOutlined />,
  stack: <BuildOutlined />,
  heading: <FontSizeOutlined />,
  text: <AlignLeftOutlined />,
  button: <BorderOutlined />,
  image: <PictureOutlined />,
  icon: <StarOutlined />,
  spacer: <VerticalAlignMiddleOutlined />,
  divider: <LineOutlined />,
}

const STYLES = `
.sf-chip { display:flex; flex-direction:column; align-items:center; gap:5px; padding:10px 6px; border:1px solid #eee; border-radius:8px; cursor:grab; background:#fff; user-select:none; transition:border-color .12s, box-shadow .12s, color .12s; }
.sf-chip:hover { border-color:#1677ff; color:#1677ff; box-shadow:0 2px 8px rgba(22,119,255,.12); }
.sf-chip:active { cursor:grabbing; }
.sf-chip .sf-chip-ic { font-size:18px; color:#8c8c8c; line-height:1; }
.sf-chip:hover .sf-chip-ic { color:#1677ff; }
.sf-chip .sf-chip-tx { font-size:14px; line-height:1; }
.sf-row { display:flex; align-items:center; gap:6px; height:32px; padding-right:6px; border-radius:6px; cursor:grab; user-select:none; white-space:nowrap; overflow:hidden; touch-action:none; }
.sf-row:hover { background:#f5f5f5; }
.sf-row-ro { cursor:pointer; }
.sf-row-sel, .sf-row-sel:hover { background:#e6f4ff; }
.sf-row-overlay { background:#fff; box-shadow:0 6px 18px rgba(0,0,0,.16); cursor:grabbing; }
.sf-caret { width:16px; flex:0 0 auto; display:inline-flex; align-items:center; justify-content:center; color:#999; font-size:12px; }
.sf-row-ic { flex:0 0 auto; color:#8c8c8c; display:inline-flex; }
.sf-row-tx { overflow:hidden; text-overflow:ellipsis; }
.sf-rename { flex:1 1 auto; min-width:0; box-sizing:border-box; font:inherit; font-size:14px; padding:1px 5px; border:1px solid #1677ff; border-radius:4px; outline:none; background:#fff; }
`

// 樹節點右鍵選單。
const NODE_MENU: MenuProps['items'] = [
  { key: 'rename', label: '重新命名', icon: <EditOutlined /> },
  { key: 'duplicate', label: '複製', icon: <CopyOutlined /> },
  { type: 'divider' },
  { key: 'delete', label: '刪除', icon: <DeleteOutlined />, danger: true },
]

interface Props {
  blocks: BlockInstance[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAdd: (type: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onRename: (id: string, name: string) => void
  onReorderMove: (move: ReorderMove) => void
  readOnly?: boolean
}

// 自動標籤(忽略自訂名)—— Figma 式「每個節點自我描述」。
function autoLabelOf(n: { type: string; data: Record<string, unknown> }): string {
  const d = n.data ?? {}
  const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
  const trunc = (s: string) => (s.length > 14 ? `${s.slice(0, 14)}…` : s)
  const text = str(d.text) ?? str(d.label)
  if (text) return trunc(text)
  if (n.type === 'icon') return ICON_LABELS[d.name as IconName] ?? '圖示'
  if (n.type === 'image') {
    const alt = str(d.alt)
    if (alt) return trunc(alt)
  }
  return blockTypeMap[n.type]?.name ?? n.type
}
function labelOf(n: { name?: string; type: string; data: Record<string, unknown> }): string {
  return n.name?.trim() || autoLabelOf(n)
}

interface EditingState {
  id: string
  prefill: string
  auto: string
}

type SortableRowProps = {
  item: FlatBlock
  depth: number
  selected: boolean
  isCollapsed: boolean
  editingState: EditingState | null
  readOnly?: boolean
  onSelect: (id: string | null) => void
  onToggleCollapse: (id: string) => void
  onMenu: (item: FlatBlock, key: string) => void
  onRename: (item: FlatBlock, val: string) => void
  onEndRename: () => void
}

function SortableRow({
  item,
  depth,
  selected,
  isCollapsed,
  editingState,
  readOnly,
  onSelect,
  onToggleCollapse,
  onMenu,
  onRename,
  onEndRename,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: readOnly,
  })
  const style = {
    transform: DndCSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }
  const label = labelOf(item)

  const rowInner = (
    <div
      className={`sf-row${selected ? ' sf-row-sel' : ''}${readOnly ? ' sf-row-ro' : ''}`}
      style={{ paddingLeft: 4 + depth * INDENT_WIDTH }}
      onClick={(e) => {
        e.stopPropagation()
        if (!editingState) onSelect(selected ? null : item.id)
      }}
      {...attributes}
      {...listeners}
    >
      {item.isContainer && item.hasChildren ? (
        <span
          className="sf-caret"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse(item.id)
          }}
        >
          {isCollapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
        </span>
      ) : (
        <span className="sf-caret" />
      )}
      <span className="sf-row-ic">{PALETTE_ICONS[item.type]}</span>
      {editingState ? (
        <input
          className="sf-rename"
          autoFocus
          defaultValue={editingState.prefill}
          placeholder={editingState.auto}
          onFocus={(e) => e.currentTarget.select()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') onRename(item, e.currentTarget.value)
            else if (e.key === 'Escape') onEndRename()
          }}
          onBlur={(e) => onRename(item, e.currentTarget.value)}
        />
      ) : (
        <span className="sf-row-tx" title={label}>
          {label}
        </span>
      )}
    </div>
  )

  return (
    <li ref={setNodeRef} style={style} className="list-none">
      {readOnly ? (
        rowInner
      ) : (
        <Dropdown
          trigger={['contextMenu']}
          menu={{ items: NODE_MENU, onClick: (i) => onMenu(item, i.key) }}
        >
          {rowInner}
        </Dropdown>
      )}
    </li>
  )
}

function BlockListInner({
  blocks,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
  onDuplicate,
  onRename,
  onReorderMove,
  readOnly,
}: Props) {
  const [collapsedIdSet, setCollapsedIdSet] = useState<Set<string>>(() => new Set())
  const [editingState, setEditingState] = useState<EditingState | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [offsetLeft, setOffsetLeft] = useState(0)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const flattened = useMemo(() => {
    const all = flattenBlocks(blocks)
    const collapsedIds = all
      .filter((i) => i.hasChildren && collapsedIdSet.has(i.id))
      .map((i) => i.id)
    const hidden = activeId ? [activeId, ...collapsedIds] : collapsedIds
    return removeChildrenOf(all, hidden)
  }, [blocks, collapsedIdSet, activeId])

  const sortedIds = useMemo(() => flattened.map((i) => i.id), [flattened])
  const activeItem = activeId ? (flattened.find((i) => i.id === activeId) ?? null) : null
  const projected =
    activeId && overId ? getProjection(flattened, activeId, overId, offsetLeft) : null

  const beginRename = (item: FlatBlock) => {
    const auto = autoLabelOf(item)
    setEditingState({ id: item.id, prefill: item.name?.trim() || auto, auto })
  }
  const toggleCollapse = (id: string) =>
    setCollapsedIdSet((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const onMenu = (item: FlatBlock, key: string) => {
    if (key === 'rename') beginRename(item)
    else if (key === 'duplicate') onDuplicate(item.id)
    else if (key === 'delete') onDelete(item.id)
  }
  const submitRename = (item: FlatBlock, val: string) => {
    const trimmed = val.trim()
    onRename(item.id, trimmed === autoLabelOf(item) ? '' : trimmed)
    setEditingState(null)
  }

  const reset = () => {
    setActiveId(null)
    setOverId(null)
    setOffsetLeft(0)
  }
  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    setOverId(String(active.id))
  }
  const onDragMove = ({ delta }: DragMoveEvent) => setOffsetLeft(delta.x)
  const onDragOver = ({ over }: DragOverEvent) => setOverId(over ? String(over.id) : null)
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const proj = projected
    reset()
    if (!over || !proj) return
    // 只吐「搬移意圖」(結構性,與 data 無關);由 BlockTreeEditor 套到當下 blocks。
    // 這樣 BlockList 可以只在結構/標籤變時重繪(memo),改 data(如粗度)不會狂重繪。
    onReorderMove({
      activeId: String(active.id),
      overId: String(over.id),
      depth: proj.depth,
      parentId: proj.parentId,
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <style>{STYLES}</style>

      {/* 唯讀時不顯示積木庫(不能新增)。 */}
      {!readOnly && (
        <div className="grid grid-cols-2 gap-1.5">
          {blockTypes.map((bt) => (
            <div
              key={bt.type}
              className="sf-chip"
              draggable
              title="點擊新增，或拖到畫布"
              onDragStart={(e) => {
                e.dataTransfer.setData('sf/block-type', bt.type)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => onAdd(bt.type)}
            >
              <span className="sf-chip-ic">{PALETTE_ICONS[bt.type]}</span>
              <span className="sf-chip-tx">{bt.name}</span>
            </div>
          ))}
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="px-1 py-2 text-sm text-[#999]">還沒有區塊。點上面的積木、或拖到畫布。</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={reset}
        >
          <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
            <ul className="m-0 list-none p-0">
              {flattened.map((item) => (
                <SortableRow
                  key={item.id}
                  item={item}
                  depth={item.id === activeId && projected ? projected.depth : item.depth}
                  selected={item.id === selectedId}
                  isCollapsed={collapsedIdSet.has(item.id)}
                  editingState={editingState?.id === item.id ? editingState : null}
                  readOnly={readOnly}
                  onSelect={onSelect}
                  onToggleCollapse={toggleCollapse}
                  onMenu={onMenu}
                  onRename={submitRename}
                  onEndRename={() => setEditingState(null)}
                />
              ))}
            </ul>
          </SortableContext>
          <DragOverlay>
            {activeItem ? (
              <div className="sf-row sf-row-sel sf-row-overlay" style={{ paddingLeft: 4 }}>
                <span className="sf-caret" />
                <span className="sf-row-ic">{PALETTE_ICONS[activeItem.type]}</span>
                <span className="sf-row-tx">{labelOf(activeItem)}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

// 結構簽章:id/type/顯示標籤/巢狀順序。樹只在「結構或標籤」變時重繪 → 改 data(粗度/顏色/方向)
// 不重繪、不卡。安全前提:重排只吐「意圖」交由父層套到當下 blocks,BlockList 從不從自己(可能因 memo
// 而過期、但結構相同)的 blocks 重建 —— 見 onDragEnd + BlockTreeEditor.reorderMove。
function structSig(nodes: BlockInstance[]): string {
  let out = ''
  for (const n of nodes) {
    out += `${n.id}:${n.type}:${labelOf(n)}(`
    if (n.children) out += structSig(n.children)
    out += ')'
  }
  return out
}

export const BlockList = memo(
  BlockListInner,
  (a, b) =>
    a.selectedId === b.selectedId &&
    a.readOnly === b.readOnly &&
    a.onSelect === b.onSelect &&
    a.onAdd === b.onAdd &&
    a.onDelete === b.onDelete &&
    a.onDuplicate === b.onDuplicate &&
    a.onRename === b.onRename &&
    a.onReorderMove === b.onReorderMove &&
    structSig(a.blocks) === structSig(b.blocks),
)
