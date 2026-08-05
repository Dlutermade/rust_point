import { App, Button, Form, Spin } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { footerApi } from '../../../../api/footer'
import { PageFormShell } from '../../../../components/page-template/PageFormShell'
import type { PageFormValues } from '../../../../components/page-template/PageFormShell'
import { buildPublishConfirm } from '../../../../components/page-template/publishConfirm'

// /pages/footer/new — 新建頁尾。?from=<id> 走複製流程:載入來源當起點,按儲存草稿/發布才寫 server。
export const Route = createFileRoute('/_layout/pages/footer/new')({
  component: FooterNewPage,
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
})

function FooterNewPage() {
  const navigate = useNavigate()
  const { from } = Route.useSearch()
  const { message, modal } = App.useApp()
  const qc = useQueryClient()
  const [form] = Form.useForm<PageFormValues>()

  const source = useQuery({
    queryKey: ['footer', 'entity', from],
    queryFn: () => footerApi.get(from as string),
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
      const t = await footerApi.createDraft(values.name.trim())
      await footerApi.saveDraft(t.id, { content: values.content })
      if (action === 'publish') await footerApi.publish(t.id, {})
      return { id: t.id, action }
    },
    onSuccess: ({ id, action }) => {
      message.success(action === 'publish' ? '已發布' : '已儲存草稿')
      qc.invalidateQueries({ queryKey: ['footer'] })
      if (action === 'publish') navigate({ to: '/pages/footer' })
      else navigate({ to: '/pages/footer/$templateId', params: { templateId: id } })
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
      heading={src ? `複製自「${src.name}」` : '新建頁尾'}
      form={form}
      initialValues={{ name: src ? `${src.name} 副本` : '', content: src?.content ?? [] }}
      editorTitle="編輯頁尾內容"
      previewId="new"
      frame="footer"
      onBackToList={() => navigate({ to: '/pages/footer' })}
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
