import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Button,
  ColorPicker,
  ConfigProvider,
  Form,
  Input,
  InputNumber,
  Select,
  Slider,
  Switch,
} from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import { blockTypeMap, toSpacing } from '@sc/blocks'
import type { BlockField } from '@sc/blocks'
import type { BlockInstance, BlockSize, Pos9, SizeMode } from '../../api/types'

const ACTION_KINDS = [
  { label: '無', value: 'none' },
  { label: '前往連結', value: 'navigate' },
  { label: '前往結帳', value: 'begin_checkout' },
  { label: '加入購物車', value: 'add_to_cart' },
  { label: '開購物車', value: 'view_cart' },
  { label: '登入', value: 'login' },
]

interface ActionValue {
  kind?: string
  params?: Record<string, string>
  newTab?: boolean
}

export function SettingsPanel({
  instance,
  onChange,
  onSize,
  onPos,
  parentIsStack,
  readOnly,
}: {
  instance: BlockInstance | null
  onChange: (data: Record<string, unknown>) => void
  onSize: (size: BlockSize) => void
  onPos: (pos: Pos9) => void
  parentIsStack: boolean
  readOnly?: boolean
}) {
  if (!instance) {
    return (
      <div className="mt-10 text-center text-sm leading-[1.8] text-[#bbb]">
        點左側圖層、或畫布上的區塊
        <br />
        來編輯它的設定
      </div>
    )
  }
  const bt = blockTypeMap[instance.type]
  if (!bt) return null

  const set = (key: string, value: unknown) => onChange({ ...instance.data, [key]: value })

  return (
    // 唯讀:componentDisabled 一次把面板內所有 antd 欄位鎖住,客戶看得到設定值但不能改。
    <ConfigProvider componentDisabled={readOnly}>
      <div className="mb-3 font-semibold">{bt.name} 設定</div>
      <SizeSection size={instance.size} onSize={onSize} />
      {parentIsStack && (
        <div className="mb-4">
          <div className="field-label mb-1.5">位置（在疊層中）</div>
          <AlignGrid value={instance.pos} onChange={onPos} />
        </div>
      )}
      {/* component={false}:只要 Form.Item 的垂直排版 + context,不渲染真的 <form>,
          否則 SettingsPanel 在 PageFormShell 的 ProForm 裡會變成巢狀 form(HTML 不合法)。 */}
      <Form layout="vertical" component={false}>
        {bt.schema.fields
          .filter((f) => showField(f, instance.data))
          .map((f) => (
            <Form.Item key={f.key} label={f.label}>
              {renderControl(f, instance.data[f.key], (v) => set(f.key, v))}
            </Form.Item>
          ))}
      </Form>
    </ConfigProvider>
  )
}

// 條件顯示:showIf 有 equals → 相等才顯示;否則該欄位為真值才顯示(給「開關 → 展開細節」)。
function showField(f: BlockField, data: Record<string, unknown>): boolean {
  if (!f.showIf) return true
  const cur = data[f.showIf.key]
  return 'equals' in f.showIf ? cur === f.showIf.equals : !!cur
}

function renderControl(field: BlockField, value: unknown, onChange: (v: unknown) => void) {
  switch (field.type) {
    case 'textarea':
      return (
        <Input.TextArea
          rows={3}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value) || 0
      const min = field.min ?? 0
      const max = field.max ?? 100
      const step = field.step ?? 1
      return (
        <div className="flex items-center gap-3">
          <Slider
            min={min}
            max={max}
            step={step}
            value={n}
            onChange={(v) => onChange(v)}
            style={{ flex: 1 }}
          />
          <InputNumber
            min={min}
            max={max}
            step={step}
            value={n}
            onChange={(v) => onChange(v ?? min)}
            style={{ width: 72 }}
          />
        </div>
      )
    }
    case 'spacing':
      return <SpacingControl field={field} value={value} onChange={onChange} />
    case 'color':
      return (
        <ColorPicker
          value={(value as string) || '#ffffff'}
          showText
          allowClear
          onChange={(c) => onChange(c.toHexString())}
          onClear={() => onChange(undefined)}
        />
      )
    case 'select':
      return (
        <Select
          value={value as string}
          options={field.options}
          style={{ width: '100%' }}
          onChange={onChange}
        />
      )
    case 'boolean':
      return <Switch checked={!!value} onChange={onChange} />
    case 'action':
      return <ActionControl value={value as ActionValue | undefined} onChange={onChange} />
    default:
      // text / image / url
      return (
        <Input
          value={(value as string) ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

// X/Y 兩軸間距,每軸一條 Slider(可拉)+ 數字框。可鎖定連動(X=Y)。
function SpacingControl({
  field,
  value,
  onChange,
}: {
  field: BlockField
  value: unknown
  onChange: (v: unknown) => void
}) {
  const v = toSpacing(value, 0)
  const [locked, setLocked] = useState(v.x === v.y)
  const min = field.min ?? 0
  const max = field.max ?? 120
  const step = field.step ?? 1
  const setX = (x: number) => onChange(locked ? { x, y: x } : { x, y: v.y })
  const setY = (y: number) => onChange(locked ? { x: y, y } : { x: v.x, y })

  const axis = (
    label: string,
    hint: string,
    n: number,
    on: (v: number) => void,
    trailing: ReactNode,
  ) => (
    <div className="flex items-center gap-2">
      <span title={hint} className="w-4 flex-none text-center text-[#999]">
        {label}
      </span>
      <Slider min={min} max={max} step={step} value={n} onChange={on} style={{ flex: 1 }} />
      <InputNumber
        min={min}
        max={max}
        step={step}
        value={n}
        size="small"
        onChange={(x) => on(x ?? 0)}
        style={{ width: 58, flex: '0 0 auto' }}
      />
      {trailing}
    </div>
  )

  const lockBtn = (
    <Button
      size="small"
      type={locked ? 'primary' : 'text'}
      icon={<LinkOutlined />}
      title="鎖定 X=Y"
      className="flex-none"
      onClick={() => setLocked((l) => !l)}
    />
  )

  return (
    <div className="flex flex-col gap-2">
      {axis('↔', '水平 X', v.x, setX, lockBtn)}
      {axis('↕', '垂直 Y', v.y, setY, <span className="w-6 flex-none" />)}
    </div>
  )
}

// 疊層中的 9 宮格位置(視覺 3×3 格)。
const POS_CELLS: Pos9[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
]
function AlignGrid({ value, onChange }: { value?: Pos9; onChange: (p: Pos9) => void }) {
  const cur = value ?? 'center'
  return (
    <div className="grid grid-cols-[repeat(3,22px)] gap-0.75">
      {POS_CELLS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onChange(c)}
          className={`h-5.5 w-5.5 cursor-pointer rounded-[3px] p-0 ${
            cur === c ? 'border-2 border-brand bg-[#e6f4ff]' : 'border border-[#d9d9d9] bg-white'
          }`}
        />
      ))}
    </div>
  )
}

// Framer 式尺寸:寬/高各選 填滿 Fill / 貼齊 Hug / 固定 Fixed。
function SizeSection({ size, onSize }: { size?: BlockSize; onSize: (s: BlockSize) => void }) {
  const s = size ?? {}
  return (
    <div className="mb-4">
      <div className="field-label mb-1.5">尺寸（Fill / Hug / Fixed）</div>
      <div className="flex gap-2">
        <SizeAxis
          label="寬 W"
          mode={s.w}
          px={s.wPx}
          onMode={(w) => onSize({ ...s, w })}
          onPx={(wPx) => onSize({ ...s, wPx })}
        />
        <SizeAxis
          label="高 H"
          mode={s.h}
          px={s.hPx}
          onMode={(h) => onSize({ ...s, h })}
          onPx={(hPx) => onSize({ ...s, hPx })}
        />
      </div>
    </div>
  )
}

function SizeAxis({
  label,
  mode,
  px,
  onMode,
  onPx,
}: {
  label: string
  mode?: SizeMode
  px?: number
  onMode: (m: SizeMode) => void
  onPx: (n: number) => void
}) {
  return (
    <div className="flex-1">
      <div className="field-label mb-1">{label}</div>
      <Select
        size="small"
        value={mode}
        placeholder="預設"
        style={{ width: '100%' }}
        onChange={onMode}
        options={[
          { label: '填滿 Fill', value: 'fill' },
          { label: '貼齊 Hug', value: 'hug' },
          { label: '固定 Fixed', value: 'fixed' },
        ]}
      />
      {mode === 'fixed' && (
        <InputNumber
          size="small"
          value={px}
          min={0}
          placeholder="px"
          style={{ width: '100%', marginTop: 4 }}
          onChange={(v) => onPx(v ?? 0)}
        />
      )}
    </div>
  )
}

function ActionControl({
  value,
  onChange,
}: {
  value: ActionValue | undefined
  onChange: (v: unknown) => void
}) {
  const kind = value?.kind ?? 'none'
  const href = value?.params?.href ?? ''
  return (
    <div className="flex flex-col gap-2">
      <Select
        value={kind}
        options={ACTION_KINDS}
        onChange={(k) => onChange({ kind: k, params: value?.params })}
      />
      {kind === 'navigate' && (
        <Input
          value={href}
          placeholder="https://…"
          onChange={(e) =>
            onChange({ kind: 'navigate', params: { ...value?.params, href: e.target.value } })
          }
        />
      )}
    </div>
  )
}
