import { Tag } from 'antd'
import type { TemplateStatus } from '../../service/storefront/shared/types'

const STATUS_META: Record<TemplateStatus, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  active: { color: 'green', label: '已發布' },
  paused: { color: 'orange', label: '暫停' },
}

// 只吃 status,不吃整個模板 —— 三個實體(首頁 / 頁首 / 頁尾)已經沒有共同型別了,
// 而這個元件本來就只用得到狀態這一欄。
type StatusTagProps = { status: TemplateStatus }

// 三個版位共用:草稿 / 已發布 / 暫停 是模板本身的狀態,與版位無關。
// 哪天某個版位的狀態機長出自己的樣子(例如頁首多一個「排程中」),再拆進該版位。
// 只回答「現在是什麼狀態」,三種狀態都是同一種呈現(同尺寸、同外框、同一種色階)。
// 動作(暫停 / 恢復)不放這裡 —— 混進來會讓同一個狀態因為可不可操作而有深淺差異。
// 「常態版 / 站台預設」的意義各版位不同,由各列表自己標。
export function StatusTag({ status }: StatusTagProps) {
  const meta = STATUS_META[status]
  return <Tag color={meta.color}>{meta.label}</Tag>
}
