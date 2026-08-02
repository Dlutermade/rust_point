import { useState } from 'react'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import { App, Button, Dropdown, InputNumber, Modal, Space, Tag } from 'antd'
import type { MenuProps } from 'antd'
import { DownOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { homeApi } from '../../../../api/home'
import { resolveTemplate } from '../../../../api/resolve'
import type { PageTemplate } from '../../../../api/types'
import { AuditDrawer } from '../../../../page-block-editor/AuditDrawer'
import { StatusCell, TargetingTags } from '../../../../page-block-editor/template-ui'

// /pages/home — 首頁模板列表。首頁跑完整生效引擎;新增/編輯一律走表單頁。
export const Route = createFileRoute('/_shell/pages/home/')({
  component: HomeListPage,
})

function HomeListPage() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [auditOf, setAuditOf] = useState<string | null>(null)
  // 優先序調整(已發布唯一可就地調的槓桿;草稿的優先序在表單裡改)。
  const [priorityOf, setPriorityOf] = useState<{ id: string; value: number } | null>(null)

  const query = useQuery({ queryKey: ['home', 'list'], queryFn: () => homeApi.list() })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['home'] })
  // 「現在生效」預覽:訪客視角(guest)。
  const liveId = query.data
    ? resolveTemplate(query.data, { now: new Date(), loggedIn: false })?.id
    : undefined

  const publish = useMutation({
    mutationFn: (id: string) => homeApi.publish(id, {}),
    onSuccess: () => {
      message.success('已發布')
      invalidate()
    },
  })
  const setPriority = useMutation({
    mutationFn: (a: { id: string; p: number }) => homeApi.updatePriority(a.id, a.p),
    onSuccess: () => {
      message.success('已更新優先序')
      setPriorityOf(null)
      invalidate()
    },
  })
  const pause = useMutation({
    mutationFn: (id: string) => homeApi.pause(id),
    onSuccess: () => {
      message.success('已暫停')
      invalidate()
    },
  })
  const resume = useMutation({
    mutationFn: (id: string) => homeApi.resume(id),
    onSuccess: () => {
      message.success('已恢復')
      invalidate()
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => homeApi.remove(id),
    onSuccess: () => {
      message.success('已刪除')
      invalidate()
    },
  })

  const moreItems = (r: PageTemplate): MenuProps['items'] =>
    [
      r.status === 'draft' && {
        key: 'publish',
        label: '發布',
        onClick: () => publish.mutate(r.id),
      },
      r.status !== 'draft' && {
        key: 'priority',
        label: '調整優先序',
        onClick: () => setPriorityOf({ id: r.id, value: r.targeting?.priority ?? 0 }),
      },
      {
        key: 'dup',
        label: '複製',
        onClick: () => navigate({ to: '/pages/home/new', search: { from: r.id } }),
      },
      { key: 'audit', label: '異動紀錄', onClick: () => setAuditOf(r.id) },
      !r.isDefault && r.status !== 'active' && { type: 'divider' as const, key: 'd1' },
      !r.isDefault &&
        r.status !== 'active' && {
          key: 'del',
          label: '刪除',
          danger: true,
          onClick: () =>
            modal.confirm({
              title: `刪除「${r.name}」?`,
              okText: '刪除',
              cancelText: '取消',
              okButtonProps: { danger: true },
              onOk: () => remove.mutate(r.id),
            }),
        },
    ].filter(Boolean) as MenuProps['items']

  const columns: ProColumns<PageTemplate>[] = [
    {
      title: '名稱',
      dataIndex: 'name',
      render: (_, r) => (
        <Space>
          <strong>{r.name}</strong>
          {r.isDefault && <Tag color="blue">常態版</Tag>}
          {r.id === liveId && <Tag color="green">● 現在生效</Tag>}
        </Space>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      width: 140,
      render: (_, r) => (
        <StatusCell v={r} onToggle={(on) => (on ? resume.mutate(r.id) : pause.mutate(r.id))} />
      ),
    },
    { title: '生效條件', key: 'targeting', render: (_, r) => <TargetingTags v={r} /> },
    { title: '優先序', key: 'priority', width: 80, render: (_, r) => r.targeting?.priority ?? 0 },
    { title: '更新時間', dataIndex: 'updatedAt', width: 150 },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            type="link"
            icon={r.status === 'draft' ? undefined : <EyeOutlined />}
            onClick={() =>
              navigate({ to: '/pages/home/$templateId', params: { templateId: r.id } })
            }
          >
            {r.status === 'draft' ? '編輯' : '檢視'}
          </Button>
          <Dropdown menu={{ items: moreItems(r) }} trigger={['click']}>
            <Button size="small" type="link">
              更多 <DownOutlined />
            </Button>
          </Dropdown>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer>
      <ProTable<PageTemplate>
        headerTitle="首頁模板"
        rowKey="id"
        search={false}
        loading={query.isLoading}
        dataSource={query.data}
        columns={columns}
        pagination={false}
        options={{ reload: () => query.refetch(), density: false, setting: true }}
        toolBarRender={() => [
          <Button
            key="new"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate({ to: '/pages/home/new' })}
          >
            新建首頁模板
          </Button>,
        ]}
      />

      <Modal
        title="調整優先序"
        open={!!priorityOf}
        onCancel={() => setPriorityOf(null)}
        onOk={() => priorityOf && setPriority.mutate({ id: priorityOf.id, p: priorityOf.value })}
        confirmLoading={setPriority.isPending}
        okText="更新"
        cancelText="取消"
        destroyOnHidden
      >
        <div className="py-2">
          <div className="mb-2 text-sm text-[#666]">重疊時數字越大越優先。</div>
          <InputNumber
            className="w-full"
            value={priorityOf?.value ?? 0}
            onChange={(v) => setPriorityOf((s) => (s ? { ...s, value: v ?? 0 } : s))}
          />
        </div>
      </Modal>

      <AuditDrawer
        open={!!auditOf}
        templateId={auditOf}
        load={homeApi.audit}
        onClose={() => setAuditOf(null)}
      />
    </PageContainer>
  )
}
