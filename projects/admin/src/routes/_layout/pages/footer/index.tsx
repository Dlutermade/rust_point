import { useState } from 'react'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import { App, Button, Dropdown, Space, Tag } from 'antd'
import type { MenuProps } from 'antd'
import { DownOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { footerApi } from '../../../../api/footer'
import type { PageTemplate } from '../../../../api/types'
import { AuditDrawer } from '../../../../components/page-template/AuditDrawer'
import { StatusTag } from '../../../../components/page-template/StatusTag'

// /pages/footer — 頁尾是「外框」(Model B):只有站台預設,不跑完整生效。
export const Route = createFileRoute('/_layout/pages/footer/')({
  component: FooterListPage,
})

function FooterListPage() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [auditOf, setAuditOf] = useState<string | null>(null)

  const query = useQuery({ queryKey: ['footer', 'list'], queryFn: () => footerApi.list() })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['footer'] })

  const publish = useMutation({
    mutationFn: (id: string) => footerApi.publish(id, {}),
    onSuccess: () => {
      message.success('已發布')
      invalidate()
    },
  })
  const setDefault = useMutation({
    mutationFn: (id: string) => footerApi.setDefault(id),
    onSuccess: () => {
      message.success('已設為站台預設')
      invalidate()
    },
  })
  const pause = useMutation({
    mutationFn: (id: string) => footerApi.pause(id),
    onSuccess: () => {
      message.success('已暫停')
      invalidate()
    },
  })
  const resume = useMutation({
    mutationFn: (id: string) => footerApi.resume(id),
    onSuccess: () => {
      message.success('已恢復')
      invalidate()
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => footerApi.remove(id),
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
      // 生效 / 暫停是動作,收在這裡;狀態欄只負責顯示狀態,不混控件。
      r.status !== 'draft' && {
        key: 'toggle',
        label: r.status === 'active' ? '暫停' : '恢復生效',
        disabled: r.isDefault,
        onClick: () => (r.status === 'active' ? pause.mutate(r.id) : resume.mutate(r.id)),
      },
      r.status === 'active' &&
        !r.isDefault && {
          key: 'default',
          label: '設為站台預設',
          onClick: () => setDefault.mutate(r.id),
        },
      {
        key: 'dup',
        label: '複製',
        onClick: () => navigate({ to: '/pages/footer/new', search: { from: r.id } }),
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
          {r.name}
          {r.isDefault && <Tag color="green">● 站台預設（生效中）</Tag>}
        </Space>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      width: 140,
      render: (_, r) => <StatusTag v={r} />,
    },
    { title: '更新時間', dataIndex: 'updatedAt', width: 160 },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            type="link"
            icon={r.status === 'draft' ? <EditOutlined /> : <EyeOutlined />}
            onClick={() =>
              navigate({ to: '/pages/footer/$templateId', params: { templateId: r.id } })
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
        headerTitle="頁尾設定"
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
            onClick={() => navigate({ to: '/pages/footer/new' })}
          >
            新建頁尾
          </Button>,
        ]}
      />

      <AuditDrawer
        open={!!auditOf}
        templateId={auditOf}
        load={footerApi.audit}
        onClose={() => setAuditOf(null)}
      />
    </PageContainer>
  )
}
