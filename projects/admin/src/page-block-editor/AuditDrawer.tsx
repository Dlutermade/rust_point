import { Drawer, Empty, Timeline } from 'antd'
import { useQuery } from '@tanstack/react-query'
import type { AuditAction, AuditEntry } from '../api/types'

const actionLabel: Record<AuditAction, string> = {
  create: '建立草稿',
  'save-draft': '存草稿',
  publish: '發布',
  duplicate: '複製',
  priority: '調整優先序',
  pause: '暫停',
  resume: '恢復',
  'set-default': '設為站台預設',
}

// 異動紀錄(共用)。每個模板的操作歷史 —— 可回溯「何時被誰做了什麼」。
export function AuditDrawer({
  open,
  templateId,
  load,
  onClose,
}: {
  open: boolean
  templateId: string | null
  load: (id: string) => Promise<AuditEntry[]>
  onClose: () => void
}) {
  const q = useQuery({
    queryKey: ['audit', templateId],
    queryFn: () => load(templateId as string),
    enabled: open && !!templateId,
  })

  return (
    <Drawer title="異動紀錄" open={open} onClose={onClose} size="default">
      {q.data && q.data.length > 0 ? (
        <Timeline
          items={q.data.map((a) => ({
            children: (
              <div>
                <div>
                  {actionLabel[a.action] ?? a.action}
                  {a.detail ? ` · ${a.detail}` : ''}
                </div>
                <div className="text-sm text-[#999]">{a.at}</div>
              </div>
            ),
          }))}
        />
      ) : (
        <Empty description="尚無異動" />
      )}
    </Drawer>
  )
}
