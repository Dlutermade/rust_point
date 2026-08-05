import { Space, Tag } from 'antd'
import { ClockCircleOutlined, GlobalOutlined, UserOutlined } from '@ant-design/icons'
import type { PageTemplate } from '../../api/types'
import { hasUtm } from '../../api/resolve'

// 生效條件:用小 Tag 呈現「什麼時候、給誰、從哪來」。
// 沒條件時也走 Tag(淡色)—— 純文字沒有外框內距,和有條件的列擺在一起列高會跳。
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

  if (!tags.length) {
    tags.push(
      <Tag key="none" style={{ color: '#bbb' }}>
        不限條件
      </Tag>,
    )
  }

  return (
    <Space size={4} wrap>
      {tags}
    </Space>
  )
}
