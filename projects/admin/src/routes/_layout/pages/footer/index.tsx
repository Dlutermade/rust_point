import { useState } from 'react'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import { App, Button, Dropdown, Space, Tag } from 'antd'
import type { MenuProps } from 'antd'
import { DownOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { pageTitle } from '../../../../shared/head'
import { footerApi } from '../../../../service/storefront/footer'
import type { FooterTemplate } from '../../../../service/storefront/footer'
import { AuditDrawer } from '../../../../components/page-template/AuditDrawer'
import { StatusTag } from '../../../../components/page-template/StatusTag'

// /pages/footer — 頁尾是「外框」(Model B):只有站台預設,不跑完整生效。
export const Route = createFileRoute('/_layout/pages/footer/')({
  head: () => ({ meta: [{ title: pageTitle('頁尾設定') }] }),
  component: FooterListPage,
})

function FooterListPage() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [auditingTemplateId, setAuditingTemplateId] = useState<string | null>(null)

  const listQuery = useQuery({ queryKey: ['footer', 'list'], queryFn: () => footerApi.list() })
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ['footer'] })

  const publishMutation = useMutation({
    mutationFn: (id: string) => footerApi.publish(id, {}),
    onSuccess: () => {
      message.success('已發布')
      void invalidateList()
    },
  })
  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => footerApi.setSiteDefault(id),
    onSuccess: () => {
      message.success('已設為站台預設')
      void invalidateList()
    },
  })
  const pauseMutation = useMutation({
    mutationFn: (id: string) => footerApi.pause(id),
    onSuccess: () => {
      message.success('已暫停')
      void invalidateList()
    },
  })
  const resumeMutation = useMutation({
    mutationFn: (id: string) => footerApi.resume(id),
    onSuccess: () => {
      message.success('已恢復')
      void invalidateList()
    },
  })
  const removeMutation = useMutation({
    mutationFn: (id: string) => footerApi.remove(id),
    onSuccess: () => {
      message.success('已刪除')
      void invalidateList()
    },
  })

  const genMoreItems = (template: FooterTemplate): MenuProps['items'] =>
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
        disabled: template.isSiteDefault,
        onClick: () =>
          template.status === 'active'
            ? pauseMutation.mutate(template.id)
            : resumeMutation.mutate(template.id),
      },
      template.status === 'active' &&
        !template.isSiteDefault && {
          key: 'default',
          label: '設為站台預設',
          onClick: () => setDefaultMutation.mutate(template.id),
        },
      {
        key: 'dup',
        label: '複製',
        onClick: () => navigate({ to: '/pages/footer/new', search: { from: template.id } }),
      },
      { key: 'audit', label: '異動紀錄', onClick: () => setAuditingTemplateId(template.id) },
      !template.isSiteDefault &&
        template.status !== 'active' && { type: 'divider' as const, key: 'd1' },
      !template.isSiteDefault &&
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

  const columns: ProColumns<FooterTemplate>[] = [
    {
      title: '名稱',
      dataIndex: 'name',
      render: (_, template) => (
        <Space>
          {template.name}
          {template.isSiteDefault && <Tag color="green">● 站台預設（生效中）</Tag>}
        </Space>
      ),
    },
    {
      title: '狀態',
      dataIndex: 'status',
      width: 140,
      render: (_, template) => <StatusTag status={template.status} />,
    },
    { title: '更新時間', dataIndex: 'updatedAt', width: 160 },
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
              navigate({ to: '/pages/footer/$templateId', params: { templateId: template.id } })
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
      <ProTable<FooterTemplate>
        headerTitle="頁尾設定"
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
            onClick={() => navigate({ to: '/pages/footer/new' })}
          >
            新建頁尾
          </Button>,
        ]}
      />

      <AuditDrawer
        isOpened={!!auditingTemplateId}
        templateId={auditingTemplateId}
        loadEntries={footerApi.audit}
        onCloseDrawer={() => setAuditingTemplateId(null)}
      />
    </PageContainer>
  )
}
