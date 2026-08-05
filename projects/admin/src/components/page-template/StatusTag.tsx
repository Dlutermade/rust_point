import { Tag } from 'antd'
import type { PageTemplate, TemplateStatus } from '../../api/types'

export const statusMeta: Record<TemplateStatus, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  active: { color: 'green', label: '已發布' },
  paused: { color: 'orange', label: '暫停' },
}

// 只回答「現在是什麼狀態」,三種狀態都是同一種呈現(同尺寸、同外框、同一種色階)。
// 動作(暫停 / 恢復)不放這裡 —— 混進來會讓同一個狀態因為可不可操作而有深淺差異。
// 「常態版 / 站台預設」的意義各版位不同,由各列表自己標。
export function StatusTag({ v }: { v: PageTemplate }) {
  const m = statusMeta[v.status]
  return <Tag color={m.color}>{m.label}</Tag>
}
