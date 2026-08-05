import { App, Button, Form, Spin } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { headerApi } from '../../../../api/header'
import { PageFormShell } from '../../../../components/page-template/PageFormShell'
import type { PageFormValues } from '../../../../components/page-template/PageFormShell'
import { buildPublishConfirm } from '../../../../components/page-template/publishConfirm'

// /pages/header/new — 新建頁首。?from=<id> 走複製流程:載入來源當起點,按儲存草稿/發布才寫 server。
export const Route = createFileRoute('/_layout/pages/header/new')({
  component: HeaderNewPage,
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
})

function HeaderNewPage() {
  const navigate = useNavigate()
  const { from } = Route.useSearch()
  const { message, modal } = App.useApp()
  const qc = useQueryClient()
  const [form] = Form.useForm<PageFormValues>()

  const source = useQuery({
    queryKey: ['header', 'entity', from],
    queryFn: () => headerApi.get(from as string),
    enabled: !!from,
  })
  const src = from ? source.data : undefined

  const submit = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: 'draft' | 'publish'
      values: PageFormValues
    }) => {
      const t = await headerApi.createDraft(values.name.trim())
      await headerApi.saveDraft(t.id, { content: values.content })
      if (action === 'publish') await headerApi.publish(t.id, {})
      return { id: t.id, action }
    },
    onSuccess: ({ id, action }) => {
      message.success(action === 'publish' ? '已發布' : '已儲存草稿')
      qc.invalidateQueries({ queryKey: ['header'] })
      if (action === 'publish') navigate({ to: '/pages/header' })
      else navigate({ to: '/pages/header/$templateId', params: { templateId: id } })
    },
  })
  const runDraft = () =>
    form.validateFields().then((values) => submit.mutate({ action: 'draft', values }))
  const runPublish = () =>
    form.validateFields().then((values) => {
      modal.confirm(
        buildPublishConfirm({ name: values.name, kind: 'chrome' }, () =>
          submit.mutateAsync({ action: 'publish', values }),
        ),
      )
    })

  if (from && source.isLoading) {
    return (
      <div className="p-16 text-center">
        <Spin />
      </div>
    )
  }

  return (
    <PageFormShell
      heading={src ? `複製自「${src.name}」` : '新建頁首'}
      form={form}
      initialValues={{ name: src ? `${src.name} 副本` : '', content: src?.content ?? [] }}
      editorTitle="編輯頁首內容"
      previewId="new"
      frame="header"
      onBackToList={() => navigate({ to: '/pages/header' })}
      footerActions={[
        <Button key="draft" loading={submit.isPending} onClick={runDraft}>
          儲存草稿
        </Button>,
        <Button
          key="pub"
          type="primary"
          icon={<SaveOutlined />}
          loading={submit.isPending}
          onClick={runPublish}
        >
          發布
        </Button>,
      ]}
    />
  )
}
