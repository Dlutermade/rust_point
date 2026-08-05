import { useEffect, useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import { consoleSink, installEventRouter, setContext } from '@sc/blocks'
import type { BlockInstance } from '../../api/types'
import { BlockView } from './BlockView'
import { SelectionOverlay } from './SelectionOverlay'

const STATIC_CSS = `.sf-canvas [data-block-id] { cursor: pointer; }`

function ContextBand({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative opacity-90">
      <div className="absolute left-1 top-1 z-3 rounded bg-black/55 px-1.5 py-px text-[11px] text-white">
        {label}
      </div>
      <div className="pointer-events-none">{children}</div>
    </div>
  )
}

// 編頁首/頁尾時的假頁面 body:示意這條外框在整頁的位置(上面是頁首、下面是頁尾)。
function FauxBody() {
  return (
    <div className="flex select-none flex-col items-center justify-center gap-2 border-y border-dashed border-[#e5e5e5] bg-[#fafafa] py-20 text-center text-[#c0c0c0]">
      <div className="text-base">頁面內容區</div>
      <div className="text-sm">實際內容依各頁面而定，此處僅示意</div>
    </div>
  )
}

export function PreviewCanvas({
  blocks,
  selectedId,
  selectedName,
  hasParent,
  onSelect,
  onDropBlock,
  onDelete,
  onDuplicate,
  onMove,
  onSelectParent,
  onReorderBefore,
  device,
  variant,
  header,
  footer,
  frame = 'page',
  readOnly,
}: {
  blocks: BlockInstance[]
  selectedId: string | null
  selectedName: string | null
  hasParent: boolean
  onSelect: (id: string | null) => void
  onDropBlock: (type: string, parentId: string | null) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onSelectParent: () => void
  onReorderBefore: (id: string, beforeId: string | null) => void
  device: 'desktop' | 'mobile'
  variant: string
  header?: BlockInstance[]
  footer?: BlockInstance[]
  frame?: 'page' | 'header' | 'footer'
  readOnly?: boolean
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const readOnlyRef = useRef(readOnly)
  readOnlyRef.current = readOnly
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  useEffect(() => {
    setContext({ tenantId: 'preview', pageType: 'home', templateVariant: variant })
    const uninstall = installEventRouter(document, { sinks: [consoleSink] })
    return uninstall
  }, [variant])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const handler = (e: MouseEvent) => {
      let id: string | null = null
      for (const node of e.composedPath()) {
        if (node === el) break
        if (node instanceof HTMLElement) {
          // 點在選取浮層(工具列)上 → 交給它自己處理,別攔截、別當成選區塊。
          if (node.classList.contains('sf-overlay')) return
          if (node.dataset.blockId) {
            id = node.dataset.blockId
            break
          }
        }
      }
      e.preventDefault()
      e.stopPropagation()
      // 唯讀時仍可點選(看設定),只是擋掉 WC 動作、不能編輯。
      onSelectRef.current(id)
    }
    el.addEventListener('click', handler, true)
    return () => el.removeEventListener('click', handler, true)
  }, [])

  const findContainer = (path: EventTarget[]): string | null => {
    for (const node of path) {
      if (node === canvasRef.current) break
      if (
        node instanceof HTMLElement &&
        node.dataset.container !== undefined &&
        node.dataset.blockId
      ) {
        return node.dataset.blockId
      }
    }
    return null
  }
  const onDragOver = (e: DragEvent) => {
    if (readOnly) return
    e.preventDefault()
    setDropTarget(findContainer(e.nativeEvent.composedPath()))
  }
  const onDragLeave = () => setDropTarget(null)
  const onDrop = (e: DragEvent) => {
    if (readOnly) return
    e.preventDefault()
    const type = e.dataTransfer.getData('sf/block-type')
    const parentId = findContainer(e.nativeEvent.composedPath())
    setDropTarget(null)
    if (type) onDropBlock(type, parentId)
  }

  const width = device === 'mobile' ? 390 : 1180

  // 落點框:拖放時命中的容器。選取框改由 SelectionOverlay 畫(含標籤+工具列)。
  const highlightCss = `
    .sf-canvas [data-block-id="${dropTarget ?? '__none__'}"] { outline: 2px dashed #52c41a; outline-offset: -2px; }
  `

  return (
    <div className="flex min-h-full items-start justify-center bg-[#f0f0f0] p-4">
      <style>{STATIC_CSS + highlightCss}</style>
      <div
        ref={canvasRef}
        className="sf-canvas relative min-h-30 max-w-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]"
        style={{ width }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {frame === 'header' ? (
          <>
            {blocks.length === 0 ? (
              <div className="p-12 text-center text-[#999]">從左側把積木拖進來，或點擊新增。</div>
            ) : (
              blocks.map((b) => <BlockView key={b.id} instance={b} />)
            )}
            <FauxBody />
          </>
        ) : frame === 'footer' ? (
          <>
            <FauxBody />
            {blocks.length === 0 ? (
              <div className="p-12 text-center text-[#999]">從左側把積木拖進來，或點擊新增。</div>
            ) : (
              blocks.map((b) => <BlockView key={b.id} instance={b} />)
            )}
          </>
        ) : (
          <>
            {header && header.length > 0 && (
              <ContextBand label="頁首（共用）">
                {header.map((b) => (
                  <BlockView key={b.id} instance={b} />
                ))}
              </ContextBand>
            )}
            {blocks.length === 0 && (
              <div className="p-12 text-center text-[#999]">從左側把積木拖進來，或點擊新增。</div>
            )}
            {blocks.map((b) => (
              <BlockView key={b.id} instance={b} />
            ))}
            {footer && footer.length > 0 && (
              <ContextBand label="頁尾（共用）">
                {footer.map((b) => (
                  <BlockView key={b.id} instance={b} />
                ))}
              </ContextBand>
            )}
          </>
        )}

        {/* 唯讀也畫選取框(客戶看得到自己選了哪塊),但 readOnly 讓浮層藏掉編輯動作。 */}
        <SelectionOverlay
          canvasRef={canvasRef}
          selectedId={selectedId}
          selectedName={selectedName}
          hasParent={hasParent}
          blocks={blocks}
          device={device}
          readOnly={readOnly}
          onSelectParent={onSelectParent}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onReorderBefore={onReorderBefore}
        />
      </div>
    </div>
  )
}
