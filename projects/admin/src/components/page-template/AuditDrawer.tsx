import { Drawer, Empty, Timeline } from 'antd'
import { useQuery } from '@tanstack/react-query'
import type { AuditAction, AuditEntry } from '../../service/storefront/shared/types'

const ACTION_LABEL: Record<AuditAction, string> = {
  create: '建立草稿',
  'save-draft': '存草稿',
  publish: '發布',
  duplicate: '複製',
  priority: '調整優先序',
  pause: '暫停',
  resume: '恢復',
  'set-site-default': '設為站台預設',
}

type AuditDrawerProps = {
  isOpened: boolean
  templateId: string | null
  loadEntries: (id: string) => Promise<AuditEntry[]>
  onCloseDrawer: () => void
}

// 異動紀錄(共用)。每個模板的操作歷史 —— 可回溯「何時被誰做了什麼」。
export function AuditDrawer({
  isOpened,
  templateId,
  loadEntries,
  onCloseDrawer,
}: AuditDrawerProps) {
  const auditQuery = useQuery({
    queryKey: ['audit', templateId],
    queryFn: () => loadEntries(templateId as string),
    enabled: isOpened && !!templateId,
  })

  return (
    <Drawer title="異動紀錄" open={isOpened} onClose={onCloseDrawer} size="default">
      {auditQuery.data && auditQuery.data.length > 0 ? (
        <Timeline
          items={auditQuery.data.map((entry) => ({
            children: (
              <div>
                <div>
                  {ACTION_LABEL[entry.action] ?? entry.action}
                  {entry.detail ? ` · ${entry.detail}` : ''}
                </div>
                <div className="text-sm text-[#999]">{entry.at}</div>
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
