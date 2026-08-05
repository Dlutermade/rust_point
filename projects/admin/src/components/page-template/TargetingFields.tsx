import type { ReactNode } from 'react'
import {
  Button,
  ConfigProvider,
  DatePicker,
  Input,
  InputNumber,
  Radio,
  Select,
  Tooltip,
} from 'antd'
import { DeleteOutlined, PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Targeting, UtmRule } from '../../api/types'

// 生效設定:三個維度 —— 生效時間 / 受眾 / 來源(UTM 條件組 + 地理位置)+ 優先序。受控,純顯示不抓資料。
// 排版依 Ant Design Pro 表單:垂直頂標籤、固定窄寬不滿版;群組一句說明取代逐欄小字,複雜語意用 ⓘ tooltip。
export function TargetingFields({
  value,
  onChange,
  readOnly,
}: {
  value?: Targeting
  onChange?: (t: Targeting) => void
  readOnly?: boolean
}) {
  const t = value ?? {}
  const patch = (p: Partial<Targeting>) => onChange?.({ ...t, ...p })
  const schedule = t.schedule ?? {}
  const source = t.source ?? {}
  const rules = source.utm ?? []

  const setSchedule = (s: { start?: string; end?: string }) => {
    const next = { ...schedule, ...s }
    patch({ schedule: next.start || next.end ? next : undefined })
  }
  const setSource = (s: Partial<NonNullable<Targeting['source']>>) => {
    const next = { ...source, ...s }
    const has = next.utm?.length || next.geo?.length
    patch({ source: has ? next : undefined })
  }
  const setRules = (next: UtmRule[]) => setSource({ utm: next })

  return (
    // 唯讀:componentDisabled 一次鎖住整段所有 antd 元件,客戶看得到設定值但不能改。
    <ConfigProvider componentDisabled={readOnly}>
      <div className="flex max-w-150 flex-col gap-4">
        <div className="text-sm text-[#999]">各維度皆為選填。未設定的維度即不限。</div>

        <Field label="生效時間">
          <div className="flex items-center gap-2">
            <DatePicker
              showTime
              className="flex-1"
              placeholder="開始"
              value={schedule.start ? dayjs(schedule.start) : null}
              onChange={(d) => setSchedule({ start: d?.toISOString() })}
            />
            <span className="text-[#999]">~</span>
            <DatePicker
              showTime
              className="flex-1"
              placeholder="結束"
              value={schedule.end ? dayjs(schedule.end) : null}
              onChange={(d) => setSchedule({ end: d?.toISOString() })}
            />
          </div>
        </Field>

        <Field label="受眾" tip="名單與會員等級即將推出">
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            value={t.audience?.login ?? 'any'}
            onChange={(e) =>
              patch({
                audience: e.target.value === 'any' ? undefined : { login: e.target.value },
              })
            }
            options={[
              { label: '不判斷', value: 'any' },
              { label: '名單', value: 'list', disabled: true },
              { label: '有登入', value: 'required' },
              { label: '無登入', value: 'guest' },
              { label: '會員等級', value: 'tier', disabled: true },
            ]}
          />
        </Field>

        <Field
          label="UTM"
          tip="來自廣告或活動網址的 UTM 參數。設多組時，符合任一組即命中。每組內有填的欄位須全部相符，留空表示不限。"
        >
          <div className="flex flex-col items-start gap-2">
            {rules.map((r, i) => (
              <UtmGroup
                key={i}
                idx={i}
                rule={r}
                onChange={(p) => setRules(rules.map((x, j) => (j === i ? { ...x, ...p } : x)))}
                onRemove={() => setRules(rules.filter((_, j) => j !== i))}
              />
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => setRules([...rules, {}])}>
              新增 UTM 條件組
            </Button>
          </div>
        </Field>

        <Field label="地理位置">
          <Select
            mode="tags"
            className="w-full"
            placeholder="輸入國別代碼後 Enter，如 TW、JP"
            value={source.geo ?? []}
            onChange={(v) => setSource({ geo: v })}
          />
        </Field>

        <Field label="優先序" tip="多筆同時生效時，數字越大越優先">
          <InputNumber
            className="w-28"
            value={t.priority ?? 0}
            onChange={(v) => patch({ priority: v ?? 0 })}
          />
        </Field>
      </div>
    </ConfigProvider>
  )
}

// 垂直頂標籤:標籤(可帶 ⓘ)在上、控制項在下。複雜語意的說明收進 ⓘ tooltip。
function Field({ label, tip, children }: { label: string; tip?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1 text-[#333]">
        <span>{label}</span>
        {tip && (
          <Tooltip title={tip}>
            <QuestionCircleOutlined className="cursor-help text-[#bbb]" />
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  )
}

// 一組 UTM 五欄。改動時空字串收成 undefined,空組不列入命中(見 resolve.hasUtm)。
function UtmGroup({
  idx,
  rule,
  onChange,
  onRemove,
}: {
  idx: number
  rule: UtmRule
  onChange: (p: Partial<UtmRule>) => void
  onRemove: () => void
}) {
  const field = (key: keyof UtmRule, label: string, param: string) => (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-[#666]">{label}</span>
      <Input
        value={rule[key] ?? ''}
        placeholder={param}
        onChange={(e) => onChange({ [key]: e.target.value || undefined })}
      />
    </div>
  )
  return (
    <div className="w-full rounded-md border border-[#eee] bg-[#fafafa] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[#333]">條件組 {idx + 1}</span>
        <Button type="text" danger icon={<DeleteOutlined />} onClick={onRemove} title="刪除這組" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {field('source', '來源', 'utm_source')}
        {field('medium', '媒介', 'utm_medium')}
        {field('campaign', '活動', 'utm_campaign')}
        {field('term', '關鍵字', 'utm_term')}
        {field('content', '內容', 'utm_content')}
      </div>
    </div>
  )
}
