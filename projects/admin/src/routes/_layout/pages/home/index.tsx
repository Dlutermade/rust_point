import { useState } from 'react'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import { App, Button, Dropdown, InputNumber, Modal, Space, Tag } from 'antd'
import type { MenuProps } from 'antd'
import { DownOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { pageTitle } from '../../../../shared/head'
import { homeApi } from '../../../../api/home'
import { resolveTemplate } from '../../../../api/resolve'
import type { PageTemplate } from '../../../../api/types'
import { AuditDrawer } from '../../../../components/page-template/AuditDrawer'
import { StatusTag } from '../../../../components/page-template/StatusTag'
import { HomeTargetingTags } from '../../../../components/page-template/home/HomeTargetingTags'

// /pages/home — 首頁模板列表。首頁跑完整生效引擎;新增/編輯一律走表單頁。
export const Route = createFileRoute('/_layout/pages/home/')({
  head: () => ({ meta: [{ title: pageTitle('首頁模板') }] }),
  component: HomeListPage,
})

function HomeListPage() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [auditingTemplateId, setAuditingTemplateId] = useState<string | null>(null)
  // 優先序調整(已發布唯一可就地調的槓桿;草稿的優先序在表單裡改)。
  const [editingPriority, setEditingPriority] = useState<{ id: string; value: number } | null>(null)

  const listQuery = useQuery({ queryKey: ['home', 'list'], queryFn: () => homeApi.list() })
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ['home'] })
  // 「現在生效」預覽:訪客視角(guest)。
  const liveId = listQuery.data
    ? resolveTemplate(listQuery.data, { now: new Date(), loggedIn: false })?.id
    : undefined

  const publishMutation = useMutation({
    mutationFn: (id: string) => homeApi.publish(id, {}),
    onSuccess: () => {
      message.success('已發布')
      void invalidateList()
    },
  })
  const setPriorityMutation = useMutation({
    mutationFn: (a: { id: string; p: number }) => homeApi.updatePriority(a.id, a.p),
    onSuccess: () => {
      message.success('已更新優先序')
      setEditingPriority(null)
      void invalidateList()
    },
  })
  const pauseMutation = useMutation({
    mutationFn: (id: string) => homeApi.pause(id),
    onSuccess: () => {
      message.success('已暫停')
      void invalidateList()
    },
  })
  const resumeMutation = useMutation({
    mutationFn: (id: string) => homeApi.resume(id),
    onSuccess: () => {
      message.success('已恢復')
      void invalidateList()
    },
  })
  const removeMutation = useMutation({
    mutationFn: (id: string) => homeApi.remove(id),
    onSuccess: () => {
      message.success('已刪除')
      void invalidateList()
    },
  })

  const genMoreItems = (template: PageTemplate): MenuProps['items'] =>
    [
      template.status === 'draft' && {
        key: 'publish',
        label: '發布',
        onClick: () => publishMutation.mutate(template.id),
      },
      // 生效 / 暫停是動作,收在這裡;狀態欄只負責顯示狀態,不混控件。
      template.status !== 'draft' && {
        key: 'toggle',
        label: template.status === 'active' ? '暫停' : '恢復生效',
        disabled: template.isDefault,
        onClick: () =>
          template.status === 'active'
            ? pauseMutation.mutate(template.id)
            : resumeMutation.mutate(template.id),
      },
      template.status !== 'draft' && {
        key: 'priority',
        label: '調整優先序',
        onClick: () =>
          setEditingPriority({ id: template.id, value: template.targeting?.priority ?? 0 }),
      },
      {
        key: 'dup',
        label: '複製',
        onClick: () => navigate({ to: '/pages/home/new', search: { from: template.id } }),
      },
      { key: 'audit', label: '異動紀錄', onClick: () => setAuditingTemplateId(template.id) },
      !template.isDefault &&
        template.status !== 'active' && { type: 'divider' as const, key: 'd1' },
      !template.isDefault &&
        template.status !== 'active' && {
          key: 'del',
          label: '刪除',
          danger: true,
          onClick: () =>
            modal.confirm({
              title: `刪除「${template.name}」?`,
              okText: '刪除',
              cancelText: '取消',
              okButtonProps: { danger: true },
              onOk: () => removeMutation.mutate(template.id),
            }),
        },
    ].filter(Boolean) as MenuProps['items']

  const columns: ProColumns<PageTemplate>[] = [
    {
      title: '名稱',
      dataIndex: 'name',
      render: (_, template) => (
        <Space>
          {template.name}
          {template.isDefault && <Tag color="blue">常態版</Tag>}
          {template.id === liveId && <Tag color="green">● 現在生效</Tag>}
        </Space>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      width: 140,
      render: (_, template) => <StatusTag template={template} />,
    },
    {
      title: '生效條件',
      key: 'targeting',
      render: (_, template) => <HomeTargetingTags template={template} />,
    },
    {
      title: '優先序',
      key: 'priority',
      width: 80,
      render: (_, template) => template.targeting?.priority ?? 0,
    },
    { title: '更新時間', dataIndex: 'updatedAt', width: 150 },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, template) => (
        <Space>
          <Button
            size="small"
            type="link"
            icon={template.status === 'draft' ? <EditOutlined /> : <EyeOutlined />}
            onClick={() =>
              navigate({ to: '/pages/home/$templateId', params: { templateId: template.id } })
            }
          >
            {template.status === 'draft' ? '編輯' : '檢視'}
          </Button>
          <Dropdown menu={{ items: genMoreItems(template) }} trigger={['click']}>
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
        loading={listQuery.isLoading}
        dataSource={listQuery.data}
        columns={columns}
        pagination={false}
        options={{ reload: () => listQuery.refetch(), density: false, setting: true }}
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
        open={!!editingPriority}
        onCancel={() => setEditingPriority(null)}
        onOk={() =>
          editingPriority &&
          setPriorityMutation.mutate({ id: editingPriority.id, p: editingPriority.value })
        }
        confirmLoading={setPriorityMutation.isPending}
        okText="更新"
        cancelText="取消"
        destroyOnHidden
      >
        <div className="py-2">
          <div className="mb-2 text-sm text-[#666]">重疊時數字越大越優先。</div>
          <InputNumber
            className="w-full"
            value={editingPriority?.value ?? 0}
            onChange={(value) =>
              setEditingPriority((prev) => (prev ? { ...prev, value: value ?? 0 } : prev))
            }
          />
        </div>
      </Modal>

      <AuditDrawer
        isOpened={!!auditingTemplateId}
        templateId={auditingTemplateId}
        loadEntries={homeApi.audit}
        onCloseDrawer={() => setAuditingTemplateId(null)}
      />
    </PageContainer>
  )
}
