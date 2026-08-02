import { Space, Switch, Tag, Tooltip } from 'antd'
import { ClockCircleOutlined, GlobalOutlined, UserOutlined } from '@ant-design/icons'
import type { PageTemplate, TemplateStatus } from '../api/types'
import { hasUtm } from '../api/resolve'

// 三個列表共用的小顯示件(純顯示,不含資料/邏輯)。
export const statusMeta: Record<TemplateStatus, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  active: { color: 'green', label: '已發布' },
  paused: { color: 'orange', label: '暫停' },
}

// 只顯示狀態;「常態版 / 站台預設」的意義各版位不同,由各列表自己標。
export function StatusTag({ v }: { v: PageTemplate }) {
  const m = statusMeta[v.status]
  return <Tag color={m.color}>{m.label}</Tag>
}

// 列表狀態欄:已發布的用 Switch 直接切生效/暫停;草稿還沒上線,顯示 Tag。
// 常態版 / 站台預設(isDefault)恆生效,Switch 鎖住不可關。
export function StatusCell({
  v,
  onToggle,
}: {
  v: PageTemplate
  onToggle: (toActive: boolean) => void
}) {
  if (v.status === 'draft') return <Tag>草稿</Tag>
  const active = v.status === 'active'
  const sw = <Switch size="small" checked={active} disabled={v.isDefault} onChange={onToggle} />
  return (
    <Space size={8}>
      {v.isDefault ? <Tooltip title="常態版恆生效，不可暫停">{sw}</Tooltip> : sw}
      <span className="text-sm text-[#888]">{active ? '生效中' : '已暫停'}</span>
    </Space>
  )
}

// 生效條件:用小 Tag 呈現「什麼時候、給誰、從哪來」;沒條件就淡淡一句「不限條件」。
const md = (iso?: string) => (iso ? iso.slice(5, 10).replace('-', '/') : '')

export function TargetingTags({ v }: { v: PageTemplate }) {
  const t = v.targeting
  const s = t?.schedule
  const src = t?.source
  const tags = []

  if (s?.start || s?.end) {
    const label =
      s.start && s.end
        ? `${md(s.start)}–${md(s.end)}`
        : s.start
          ? `${md(s.start)} 起`
          : `${md(s.end)} 止`
    tags.push(
      <Tag key="sch" color="blue" icon={<ClockCircleOutlined />}>
        {label}
      </Tag>,
    )
  }
  if (t?.audience?.login === 'required') {
    tags.push(
      <Tag key="aud" color="geekblue" icon={<UserOutlined />}>
        會員
      </Tag>,
    )
  }
  if (t?.audience?.login === 'guest') {
    tags.push(
      <Tag key="aud" color="geekblue">
        訪客
      </Tag>,
    )
  }
  if (hasUtm(src?.utm)) {
    const n = src!.utm!.filter((r) => Object.values(r).some(Boolean)).length
    tags.push(<Tag key="utm">UTM {n > 1 ? `${n} 組` : ''}</Tag>)
  }
  if (src?.geo?.length) {
    tags.push(
      <Tag key="geo" icon={<GlobalOutlined />}>
        {src.geo.join('、')}
      </Tag>,
    )
  }

  if (!tags.length) return <span className="text-[#bbb]">不限條件</span>
  return (
    <Space size={4} wrap>
      {tags}
    </Space>
  )
}
