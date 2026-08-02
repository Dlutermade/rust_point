import { useLayoutEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react'
import {
  ApartmentOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  HolderOutlined,
  UpOutlined,
} from '@ant-design/icons'
import type { BlockInstance } from '../api/types'
import { findParent } from './tree'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}
interface Line {
  x: number
  y: number
  w: number
  h: number
}

const OVERLAY_CSS = `
.sf-overlay button:hover { background: #f0f0f0 !important; }
.sf-overlay button.sf-danger:hover { background: #fff1f0 !important; color: #ff4d4f !important; }
`

// 畫布上的選取 chrome:貼著選取元素的 bounding rect,畫藍框 + 名稱標籤 + 就近工具列。
// 量測相對於 .sf-canvas(兩個 rect 都是 viewport 座標、同時取得 → 捲動時差值不變,免重算)。
export function SelectionOverlay({
  canvasRef,
  selectedId,
  selectedName,
  hasParent,
  blocks,
  device,
  readOnly,
  onSelectParent,
  onMove,
  onDuplicate,
  onDelete,
  onReorderBefore,
}: {
  canvasRef: RefObject<HTMLDivElement | null>
  selectedId: string | null
  selectedName: string | null
  hasParent: boolean
  blocks: BlockInstance[]
  device: 'desktop' | 'mobile'
  readOnly?: boolean
  onSelectParent: () => void
  onMove: (id: string, dir: -1 | 1) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onReorderBefore: (id: string, beforeId: string | null) => void
}) {
  const [rect, setRect] = useState<Rect | null>(null)
  const [dragLine, setDragLine] = useState<Line | null>(null)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !selectedId) {
      setRect(null)
      return
    }
    const sel = `[data-block-id="${CSS.escape(selectedId)}"]`
    const compute = () => {
      const el = canvas.querySelector(sel) as HTMLElement | null
      if (!el) {
        setRect(null)
        return
      }
      const c = canvas.getBoundingClientRect()
      const e = el.getBoundingClientRect()
      setRect({ top: e.top - c.top, left: e.left - c.left, width: e.width, height: e.height })
    }
    compute()
    // WC(Lit)可能延一幀才定版面 → 下一幀再量一次。
    const raf = requestAnimationFrame(compute)
    const el = canvas.querySelector(sel) as HTMLElement | null
    const ro = new ResizeObserver(compute)
    if (el) ro.observe(el)
    ro.observe(canvas)
    window.addEventListener('resize', compute)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
    // blocks / device 變 → 版面可能位移,重量測。
  }, [canvasRef, selectedId, blocks, device])

  // ── 畫布上拖曳把手:同層兄弟間重排,拖曳時畫即時插入線 ──
  const parent = selectedId ? findParent(blocks, selectedId) : null
  const parentIsStack = parent?.type === 'stack'

  const startDrag = (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas || !selectedId) return
    const siblings = (parent?.children ?? blocks).filter((n) => n.id !== selectedId)
    const dir: 'row' | 'column' =
      parent && (parent.data as { direction?: string }).direction === 'row' ? 'row' : 'column'

    const rectOf = (id: string) => {
      const el = canvas.querySelector(`[data-block-id="${CSS.escape(id)}"]`) as HTMLElement | null
      if (!el) return null
      const c = canvas.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      return {
        top: r.top - c.top,
        left: r.left - c.left,
        width: r.width,
        height: r.height,
        bottom: r.bottom - c.top,
        right: r.right - c.left,
      }
    }

    let curBefore: string | null = null
    let moved = false

    const onMove2 = (ev: PointerEvent) => {
      const c = canvas.getBoundingClientRect()
      const p = dir === 'row' ? ev.clientX - c.left : ev.clientY - c.top
      curBefore = null
      for (const s of siblings) {
        const r = rectOf(s.id)
        if (!r) continue
        const mid = dir === 'row' ? r.left + r.width / 2 : r.top + r.height / 2
        if (p < mid) {
          curBefore = s.id
          break
        }
      }
      // 插入線:落在 beforeId 前緣;無 → 落在最後一個兄弟後緣。
      const anchor = curBefore
        ? rectOf(curBefore)
        : siblings.length
          ? rectOf(siblings[siblings.length - 1].id)
          : rectOf(selectedId)
      if (anchor) {
        setDragLine(
          dir === 'row'
            ? {
                x: (curBefore ? anchor.left : anchor.right) - 1,
                y: anchor.top,
                w: 2,
                h: anchor.height,
              }
            : {
                x: anchor.left,
                y: (curBefore ? anchor.top : anchor.bottom) - 1,
                w: anchor.width,
                h: 2,
              },
        )
      }
      moved = true
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove2)
      window.removeEventListener('pointerup', onUp)
      setDragLine(null)
      if (moved) onReorderBefore(selectedId, curBefore)
    }
    window.addEventListener('pointermove', onMove2)
    window.addEventListener('pointerup', onUp)
  }

  if (!rect || !selectedId) return null

  // 上方有空間 → 擺選取框正上方;沒空間(貼近畫布頂,如頁首)→ 擺下方,不蓋內容。
  const barTop = rect.top >= 36 ? rect.top - 32 : rect.top + rect.height + 4

  const move = (dir: -1 | 1) => onMove(selectedId, dir)

  return (
    <div className="sf-overlay pointer-events-none absolute inset-0 z-10">
      <style>{OVERLAY_CSS}</style>

      {/* 選取框(座標動態 → inline) */}
      <div
        className="pointer-events-none absolute outline-2 -outline-offset-1 outline-brand"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      />

      {/* 拖曳時的即時插入線(座標動態 → inline) */}
      {dragLine && (
        <div
          className="pointer-events-none absolute z-11 rounded-xs bg-brand shadow-[0_0_0_1px_rgba(22,119,255,0.35)]"
          style={{ top: dragLine.y, left: dragLine.x, width: dragLine.w, height: dragLine.h }}
        />
      )}

      {/* 就近工具列:名稱 + 動作合成同一條 bar(定位動態 → inline)。
          唯讀(檢視已發布)只留名稱標籤,不給任何動作。 */}
      <div
        className="pointer-events-auto absolute flex h-7.5 items-center gap-px whitespace-nowrap rounded-[7px] border border-[#e8e8e8] bg-white pl-2.25 pr-0.75 shadow-[0_3px_12px_rgba(0,0,0,0.14)]"
        style={{ top: barTop, left: Math.max(2, rect.left) }}
      >
        {selectedName && (
          <span className="text-sm font-semibold tracking-[0.2px] text-brand">{selectedName}</span>
        )}
        {!readOnly && (
          <>
            <span className="ml-2 mr-1.25 h-4 w-px bg-[#eee]" />
            {!parentIsStack && (
              <button
                type="button"
                title="拖曳重排"
                onPointerDown={startDrag}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded-sm border-none bg-transparent p-0 text-[13px] text-[#bbb]"
              >
                <HolderOutlined />
              </button>
            )}
            {hasParent && (
              <ToolBtn title="選父層" onClick={onSelectParent}>
                <ApartmentOutlined />
              </ToolBtn>
            )}
            <ToolBtn title="上移" onClick={() => move(-1)}>
              <UpOutlined />
            </ToolBtn>
            <ToolBtn title="下移" onClick={() => move(1)}>
              <DownOutlined />
            </ToolBtn>
            <ToolBtn title="複製" onClick={() => onDuplicate(selectedId)}>
              <CopyOutlined />
            </ToolBtn>
            <ToolBtn title="刪除" danger onClick={() => onDelete(selectedId)}>
              <DeleteOutlined />
            </ToolBtn>
          </>
        )}
      </div>
    </div>
  )
}

function ToolBtn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      className={`inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent p-0 text-[13px] text-[#666]${danger ? ' sf-danger' : ''}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}
