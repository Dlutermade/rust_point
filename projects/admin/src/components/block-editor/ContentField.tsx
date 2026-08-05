import { useLayoutEffect, useRef, useState } from 'react'
import { Button, Space, Tag } from 'antd'
import { EditOutlined, EyeOutlined } from '@ant-design/icons'
import type { BlockInstance } from '../../api/types'
import { BlockTreeEditor } from './BlockTreeEditor'
import { BlockView } from './BlockView'
import { writePreviewScratch } from '../../preview/scratch'

// 「頁面內容」表單欄位:內容只是表單的一個值。點「編輯頁面」叫出全螢幕編輯器,
// 編輯器按「儲存並返回」把 blocks 交回(onChange),不碰 server —— 真正落地在表單的儲存草稿/發布。
// 表單頁直接內嵌即時預覽(不用開分頁/進編輯器就看得到);點預覽即進編輯器,省下點擊。
export function ContentField({
  value,
  onChange,
  readOnly,
  editorTitle,
  previewId = 'new',
  contextHeader,
  contextFooter,
  frame,
}: {
  value?: BlockInstance[]
  onChange?: (blocks: BlockInstance[]) => void
  readOnly?: boolean
  editorTitle: string
  previewId?: string
  contextHeader?: BlockInstance[]
  contextFooter?: BlockInstance[]
  frame?: 'page' | 'header' | 'footer'
}) {
  const [open, setOpen] = useState(false)
  const blocks = value ?? []

  // 預覽(全尺寸):把 blocks 丟進 client 暫存、開新分頁看——不碰 server。
  const openPreview = (bs: BlockInstance[]) => {
    writePreviewScratch(bs)
    window.open(`/preview.html?template=${previewId}&preview=1`, '_blank', 'noopener')
  }

  const count = blocks.length

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-[#999]">
          {count ? `已編排 ${count} 個最外層區塊` : '尚未編排內容，點下方進入編排'}
        </div>
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => openPreview(blocks)} disabled={!count}>
            開新分頁預覽
          </Button>
          <Button type="primary" icon={<EditOutlined />} onClick={() => setOpen(true)}>
            {readOnly ? '檢視頁面' : '編輯頁面'}
          </Button>
        </Space>
      </div>

      {count ? (
        <InlinePreview
          blocks={blocks}
          contextHeader={contextHeader}
          contextFooter={contextFooter}
          frame={frame}
          onOpen={() => setOpen(true)}
          readOnly={readOnly}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-40 w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-[#d9d9d9] bg-[#fafafa] text-[#999]"
        >
          點此進入編排
        </button>
      )}

      {open && (
        <BlockTreeEditor
          title={editorTitle}
          initialBlocks={blocks}
          readOnly={readOnly}
          contextHeader={contextHeader}
          contextFooter={contextFooter}
          frame={frame}
          onBack={() => setOpen(false)}
          submitterRender={(b) => (
            <>
              <Button icon={<EyeOutlined />} onClick={() => openPreview(b)}>
                預覽
              </Button>
              {readOnly ? (
                <Tag color="default">檢視（唯讀）</Tag>
              ) : (
                <Button
                  type="primary"
                  onClick={() => {
                    onChange?.(b)
                    setOpen(false)
                  }}
                >
                  儲存並返回
                </Button>
              )}
            </>
          )}
        />
      )}
    </>
  )
}

// 桌面寬:頁面以此寬度渲染真積木,再等比縮到欄位寬。
const DESIGN_W = 1180

// 內嵌即時預覽:以桌面寬渲染 頁首(共用)+ 內容 + 頁尾(共用),量欄位寬做等比縮放。
// 高度隨內容(縮放後)自然撐開;pointer-events 擋掉互動,整塊點擊 = 進編輯器。
function InlinePreview({
  blocks,
  contextHeader,
  contextFooter,
  frame,
  onOpen,
  readOnly,
}: {
  blocks: BlockInstance[]
  contextHeader?: BlockInstance[]
  contextFooter?: BlockInstance[]
  frame?: 'page' | 'header' | 'footer'
  onOpen: () => void
  readOnly?: boolean
}) {
  const outerRef = useRef<HTMLButtonElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const [h, setH] = useState(0)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const update = () => {
      setW(outer.clientWidth)
      setH(inner.scrollHeight)
    }
    update()
    // WC(Lit)可能延一幀定版面、圖片載入後高度變 → 觀察內容尺寸變化重算。
    const ro = new ResizeObserver(update)
    ro.observe(outer)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [blocks, contextHeader, contextFooter])

  const scale = w ? w / DESIGN_W : 0
  // 頁面才疊頁首/頁尾上下文;頁首/頁尾本身的編輯只預覽自己。
  const showChrome = frame === 'page'

  return (
    <button
      ref={outerRef}
      type="button"
      onClick={onOpen}
      title={readOnly ? '檢視頁面' : '點擊編輯頁面'}
      className="relative block w-full cursor-pointer overflow-hidden rounded-lg border border-[#eee] bg-white p-0 text-left"
      style={{ height: scale ? h * scale : 200 }}
    >
      <div
        ref={innerRef}
        className="pointer-events-none absolute left-0 top-0"
        style={{ width: DESIGN_W, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {showChrome && contextHeader?.map((b) => <BlockView key={`h-${b.id}`} instance={b} />)}
        {blocks.map((b) => (
          <BlockView key={b.id} instance={b} />
        ))}
        {showChrome && contextFooter?.map((b) => <BlockView key={`f-${b.id}`} instance={b} />)}
      </div>
    </button>
  )
}
