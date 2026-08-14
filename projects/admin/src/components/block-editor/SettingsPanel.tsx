import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Button,
  ColorPicker,
  ConfigProvider,
  Form,
  Input,
  InputNumber,
  Segmented,
  Select,
  Slider,
  Switch,
  Tag,
} from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import { atDevice, blockTypeMap, toSpacing, withDevice } from '@sc/blocks'
import type { BlockField } from '@sc/blocks'
import type {
  BlockInstance,
  BlockSize,
  Device,
  DeviceVisibility,
  Pos9,
  SizeMode,
} from '../../service/storefront/shared/types'

const VISIBILITY_OPTIONS = [
  { label: '全部裝置', value: 'all' },
  { label: '僅電腦', value: 'desktop' },
  { label: '僅手機', value: 'mobile' },
]

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

type SettingsPanelProps = {
  instance: BlockInstance | null
  onChange: (data: Record<string, unknown>) => void
  onSize: (size: BlockSize) => void
  onPos: (pos: Pos9) => void
  onVisibility: (visibility: DeviceVisibility) => void
  /** 目前正在編哪個裝置。標了 perDevice 的欄位只讀寫這個裝置的值。 */
  device: Device
  parentIsStack: boolean
  readOnly?: boolean
}

export function SettingsPanel({
  instance,
  onChange,
  onSize,
  onPos,
  onVisibility,
  device,
  parentIsStack,
  readOnly,
}: SettingsPanelProps) {
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

      {/* 顯示裝置:做結構差異(電腦橫向選單 / 手機漢堡)用。它本身在講裝置,所以不分裝置存。 */}
      <div className="mb-4">
        <div className="field-label mb-1.5">顯示裝置</div>
        <Segmented
          block
          value={instance.visibility}
          options={VISIBILITY_OPTIONS}
          onChange={(v) => onVisibility(v as DeviceVisibility)}
        />
      </div>

      {/* 尺寸 / 位置分裝置:只改目前在看的那個,另一個維持原樣。 */}
      <SizeSection size={atDevice(instance.size, device)} onSize={onSize} />
      {parentIsStack && (
        <div className="mb-4">
          <div className="field-label mb-1.5">位置（在疊層中）</div>
          <AlignGrid value={atDevice(instance.pos, device)} onChange={onPos} />
        </div>
      )}
      {/* component={false}:只要 Form.Item 的垂直排版 + context,不渲染真的 <form>,
          否則 SettingsPanel 在 PageTemplateForm 的 ProForm 裡會變成巢狀 form(HTML 不合法)。 */}
      <Form layout="vertical" component={false}>
        {bt.schema.fields
          .filter((f) => showField(f, instance.data))
          .map((f) => (
            <Form.Item
              key={f.key}
              label={
                f.perDevice ? (
                  // 標出來,否則商家不知道自己改的只是其中一個裝置。
                  <span className="inline-flex items-center gap-1.5">
                    {f.label}
                    <Tag className="m-0" color="blue">
                      {device === 'mobile' ? '手機' : '電腦'}
                    </Tag>
                  </span>
                ) : (
                  f.label
                )
              }
            >
              {renderControl(
                f,
                f.perDevice ? atDevice(instance.data[f.key], device) : instance.data[f.key],
                (v) => set(f.key, f.perDevice ? withDevice(instance.data[f.key], device, v) : v),
              )}
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

type SpacingControlProps = {
  field: BlockField
  value: unknown
  onChange: (v: unknown) => void
}

// X/Y 兩軸間距,每軸一條 Slider(可拉)+ 數字框。可鎖定連動(X=Y)。
function SpacingControl({ field, value, onChange }: SpacingControlProps) {
  const spacing = toSpacing(value, 0)
  const [isLocked, setIsLocked] = useState(spacing.x === spacing.y)
  const min = field.min ?? 0
  const max = field.max ?? 120
  const step = field.step ?? 1
  const setX = (x: number) => onChange(isLocked ? { x, y: x } : { x, y: spacing.y })
  const setY = (y: number) => onChange(isLocked ? { x: y, y } : { x: spacing.x, y })

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
      type={isLocked ? 'primary' : 'text'}
      icon={<LinkOutlined />}
      title="鎖定 X=Y"
      className="flex-none"
      onClick={() => setIsLocked((l) => !l)}
    />
  )

  return (
    <div className="flex flex-col gap-2">
      {axis('↔', '水平 X', spacing.x, setX, lockBtn)}
      {axis('↕', '垂直 Y', spacing.y, setY, <span className="w-6 flex-none" />)}
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
type AlignGridProps = { value?: Pos9; onChange: (p: Pos9) => void }

function AlignGrid({ value, onChange }: AlignGridProps) {
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

type SizeSectionProps = { size?: BlockSize; onSize: (s: BlockSize) => void }

// Framer 式尺寸:寬/高各選 填滿 Fill / 貼齊 Hug / 固定 Fixed。
function SizeSection({ size, onSize }: SizeSectionProps) {
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

type SizeAxisProps = {
  label: string
  mode?: SizeMode
  px?: number
  onMode: (m: SizeMode) => void
  onPx: (n: number) => void
}

function SizeAxis({ label, mode, px, onMode, onPx }: SizeAxisProps) {
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

type ActionControlProps = {
  value: ActionValue | undefined
  onChange: (v: unknown) => void
}

function ActionControl({ value, onChange }: ActionControlProps) {
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
