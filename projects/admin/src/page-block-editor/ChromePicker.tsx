import { useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Modal, Spin } from 'antd'
import { CheckCircleFilled, SearchOutlined } from '@ant-design/icons'
import type { BlockInstance, ChromeOverride, PageTemplate } from '../api/types'
import { BlockView } from './BlockView'

// 頁面外框挑選(Model B):頁首/頁尾各一個「目前選擇 + 更換」欄;更換開彈窗,清單可搜尋、帶真實縮圖預覽。
// 選項是「別的外框模板」,數量無上限 → 用彈窗 + 搜尋撐規模,不用會爆版的卡片牆。
// 受控:value 是 ChromeOverride,吐回完整 ChromeOverride。放進 Form.Item name="chrome" 即自動綁定。
export function ChromePicker({
  value,
  onChange,
  headerOptions,
  footerOptions,
  loadContent,
  readOnly,
}: {
  value?: ChromeOverride
  onChange?: (v: ChromeOverride) => void
  headerOptions: PageTemplate[]
  footerOptions: PageTemplate[]
  /** 依模板 id 取該外框的內容(積木),供縮圖真預覽用。 */
  loadContent: (id: string) => Promise<BlockInstance[]>
  readOnly?: boolean
}) {
  const v = value ?? {}
  const active = (list: PageTemplate[]) => list.filter((t) => t.status === 'active')

  return (
    <div className="flex max-w-150 flex-col gap-4">
      <SlotPicker
        label="頁首"
        slot="header"
        options={active(headerOptions)}
        selectedId={v.headerId}
        loadContent={loadContent}
        readOnly={readOnly}
        onPick={(id) => onChange?.({ ...v, headerId: id })}
      />
      <SlotPicker
        label="頁尾"
        slot="footer"
        options={active(footerOptions)}
        selectedId={v.footerId}
        loadContent={loadContent}
        readOnly={readOnly}
        onPick={(id) => onChange?.({ ...v, footerId: id })}
      />
    </div>
  )
}

function descOf(t: PageTemplate): string {
  return t.isDefault ? '站台預設版' : '替代版'
}

function SlotPicker({
  label,
  slot,
  options,
  selectedId,
  loadContent,
  readOnly,
  onPick,
}: {
  label: string
  slot: 'header' | 'footer'
  options: PageTemplate[]
  selectedId?: string
  loadContent: (id: string) => Promise<BlockInstance[]>
  readOnly?: boolean
  onPick: (id: string | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = selectedId ? options.find((t) => t.id === selectedId) : undefined
  // selectedId 有值但找不到(該外框被刪/停用)→ 當成回站台預設呈現,避免顯示空白。
  const isDefault = !selected
  const selName = selected?.name ?? '站台預設'
  const selDesc = selected ? descOf(selected) : '跟隨站台設定'

  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter((t) => t.name.toLowerCase().includes(q)) : options

  const pick = (id: string | undefined) => {
    onPick(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div>
      <div className="mb-2 text-sm text-[#666]">{label}</div>
      <div className="flex items-center gap-4 rounded-lg border border-[#eee] p-3">
        <div className="w-28 flex-none">
          {isDefault ? (
            <ChromeThumb kind="default" />
          ) : (
            <ChromePreview id={selected!.id} slot={slot} loadContent={loadContent} />
          )}
        </div>
        <div className="flex flex-1 flex-col">
          <span className="font-medium text-[#333]">{selName}</span>
          <span className="text-sm text-[#999]">{selDesc}</span>
        </div>
        {!readOnly && <Button onClick={() => setOpen(true)}>更換</Button>}
      </div>

      <Modal
        open={open}
        title={`選擇${label}`}
        footer={null}
        width={720}
        onCancel={() => {
          setOpen(false)
          setQuery('')
        }}
      >
        <Input
          allowClear
          prefix={<SearchOutlined className="text-[#bbb]" />}
          placeholder={`搜尋${label}名稱`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-4 grid max-h-[60vh] grid-cols-3 gap-4 overflow-y-auto">
          {/* 站台預設永遠列在最前,不受搜尋過濾 */}
          <OptionCard
            slot={slot}
            name="站台預設"
            desc="跟隨站台設定"
            selected={isDefault}
            onClick={() => pick(undefined)}
          />
          {filtered.map((t) => (
            <OptionCard
              key={t.id}
              id={t.id}
              slot={slot}
              name={t.name}
              desc={descOf(t)}
              selected={t.id === selectedId}
              loadContent={loadContent}
              onClick={() => pick(t.id)}
            />
          ))}
        </div>
      </Modal>
    </div>
  )
}

function OptionCard({
  id,
  slot,
  name,
  desc,
  selected,
  loadContent,
  onClick,
}: {
  id?: string
  slot: 'header' | 'footer'
  name: string
  desc: string
  selected: boolean
  loadContent?: (id: string) => Promise<BlockInstance[]>
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex cursor-pointer flex-col gap-2 rounded-lg border-2 bg-white p-2 text-left ${
        selected ? 'border-brand' : 'border-[#eee] hover:border-[#d0d0d0]'
      }`}
    >
      {selected && <CheckCircleFilled className="absolute right-2 top-2 z-10 text-brand" />}
      {id && loadContent ? (
        <ChromePreview id={id} slot={slot} loadContent={loadContent} />
      ) : (
        <ChromeThumb kind="default" />
      )}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-[#333]">{name}</span>
        <span className="text-sm text-[#999]">{desc}</span>
      </div>
    </button>
  )
}

// 桌面寬:外框以此寬度渲染,再等比縮到縮圖框。
const DESIGN_W = 1180

// 縮圖真預覽:依 id 抓外框內容,以桌面寬渲染真實積木再縮放塞進固定高的框。
// 頁首對齊框頂、頁尾對齊框底(只露出貼邊那段),與實際版位一致。
function ChromePreview({
  id,
  slot,
  loadContent,
}: {
  id: string
  slot: 'header' | 'footer'
  loadContent: (id: string) => Promise<BlockInstance[]>
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const q = useQuery({
    queryKey: ['chrome-preview', id],
    queryFn: () => loadContent(id),
  })

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const blocks = q.data
  const edge = slot === 'footer' ? 'bottom' : 'top'
  return (
    <ThumbBox innerRef={boxRef}>
      {!blocks ? (
        <div className="flex h-full items-center justify-center">
          <Spin size="small" />
        </div>
      ) : blocks.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-[#bbb]">空白</div>
      ) : (
        w > 0 && (
          // 縮圖只供瀏覽,擋掉互動避免誤觸 WC 動作。
          <div
            className="pointer-events-none absolute left-0"
            style={{
              [edge]: 0,
              width: DESIGN_W,
              transform: `scale(${w / DESIGN_W})`,
              transformOrigin: `${edge} left`,
            }}
          >
            {blocks.map((b) => (
              <BlockView key={b.id} instance={b} />
            ))}
          </div>
        )
      )}
    </ThumbBox>
  )
}

// 縮圖外框:固定高、裁切、白底。
function ThumbBox({
  children,
  innerRef,
}: {
  children: React.ReactNode
  innerRef?: React.Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={innerRef}
      className="relative h-16 w-full overflow-hidden rounded border border-[#eee] bg-white"
    >
      {children}
    </div>
  )
}

// 佔位線框:站台預設(無實體內容)用;頁首 = 上緣色帶、頁尾 = 下緣色帶,中間灰線代表內容。
function ChromeThumb({ kind }: { kind: 'header' | 'footer' | 'default' }) {
  const bar = <div className="h-2.5 flex-none rounded-xs bg-[#94b8ff]" />
  const body = (
    <div className="flex flex-1 flex-col justify-center gap-1 px-1">
      <div className="h-1.5 rounded-xs bg-[#eee]" />
      <div className="h-1.5 w-2/3 rounded-xs bg-[#eee]" />
    </div>
  )
  return (
    <div className="flex h-16 flex-col gap-1 rounded border border-[#eee] bg-white p-1.5">
      {kind === 'header' && (
        <>
          {bar}
          {body}
        </>
      )}
      {kind === 'footer' && (
        <>
          {body}
          {bar}
        </>
      )}
      {kind === 'default' && (
        <div className="flex flex-1 items-center justify-center text-sm text-[#bbb]">站台預設</div>
      )}
    </div>
  )
}
