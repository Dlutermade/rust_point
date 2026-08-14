import { Space, Tag } from 'antd'
import { ClockCircleOutlined, GlobalOutlined, UserOutlined } from '@ant-design/icons'
import { hasUtm } from '../../../service/storefront/home-page'
import type { HomePageTemplate } from '../../../service/storefront/home-page'

// 生效條件:用小 Tag 呈現「什麼時候、給誰、從哪來」。
// 沒條件時也走 Tag(淡色)—— 純文字沒有外框內距,和有條件的列擺在一起列高會跳。
const genMonthDayLabel = (iso?: string) => (iso ? iso.slice(5, 10).replace('-', '/') : '')

type HomeTargetingTagsProps = { template: HomePageTemplate }

export function HomeTargetingTags({ template }: HomeTargetingTagsProps) {
  const targeting = template.targeting
  const schedule = targeting?.schedule
  const source = targeting?.source
  const tags = []

  if (schedule?.start || schedule?.end) {
    const label =
      schedule.start && schedule.end
        ? `${genMonthDayLabel(schedule.start)}–${genMonthDayLabel(schedule.end)}`
        : schedule.start
          ? `${genMonthDayLabel(schedule.start)} 起`
          : `${genMonthDayLabel(schedule.end)} 止`
    tags.push(
      <Tag key="sch" color="blue" icon={<ClockCircleOutlined />}>
        {label}
      </Tag>,
    )
  }
  if (targeting?.audience?.login === 'required') {
    tags.push(
      <Tag key="aud" color="geekblue" icon={<UserOutlined />}>
        會員
      </Tag>,
    )
  }
  if (targeting?.audience?.login === 'guest') {
    tags.push(
      <Tag key="aud" color="geekblue">
        訪客
      </Tag>,
    )
  }
  if (hasUtm(source?.utm)) {
    const groupCount = source!.utm!.filter((rule) => Object.values(rule).some(Boolean)).length
    tags.push(<Tag key="utm">UTM {groupCount > 1 ? `${groupCount} 組` : ''}</Tag>)
  }
  if (source?.geo?.length) {
    tags.push(
      <Tag key="geo" icon={<GlobalOutlined />}>
        {source.geo.join('、')}
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
