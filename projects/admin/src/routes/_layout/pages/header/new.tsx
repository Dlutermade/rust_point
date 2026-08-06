import { App, Button, Form, Spin } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { pageTitle } from '../../../../shared/head'
import { headerApi } from '../../../../api/header'
import { HeaderTemplateForm } from '../../../../components/page-template/header/HeaderTemplateForm'
import type { HeaderTemplateFormValues } from '../../../../components/page-template/header/HeaderTemplateForm'
import { genHeaderPublishConfirm } from '../../../../components/page-template/header/headerPublishConfirm'

// /pages/header/new — 新建頁首。?from=<id> 走複製流程:載入來源當起點,按儲存草稿/發布才寫 server。
export const Route = createFileRoute('/_layout/pages/header/new')({
  head: () => ({ meta: [{ title: pageTitle('新建頁首') }] }),
  component: HeaderNewPage,
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
})

// 一次送出兩種意圖:存草稿 or 直接發布,共用同一條建立流程。
type SubmitArgs = {
  action: 'draft' | 'publish'
  values: HeaderTemplateFormValues
}

function HeaderNewPage() {
  const navigate = useNavigate()
  const { from } = Route.useSearch()
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<HeaderTemplateFormValues>()

  const sourceQuery = useQuery({
    queryKey: ['header', 'template', from],
    queryFn: () => headerApi.get(from as string),
    enabled: !!from,
  })
  const sourceTemplate = from ? sourceQuery.data : undefined

  const submitMutation = useMutation({
    mutationFn: async ({ action, values }: SubmitArgs) => {
      const created = await headerApi.createDraft(values.name.trim())
      await headerApi.saveDraft(created.id, { content: values.content })
      if (action === 'publish') await headerApi.publish(created.id, {})
      return { id: created.id, action }
    },
    onSuccess: ({ id, action }) => {
      message.success(action === 'publish' ? '已發布' : '已儲存草稿')
      void queryClient.invalidateQueries({ queryKey: ['header'] })
      if (action === 'publish') navigate({ to: '/pages/header' })
      else navigate({ to: '/pages/header/$templateId', params: { templateId: id } })
    },
  })
  // validateFields() 驗證失敗會 reject —— 用 catch 收掉,antd 已在欄位上標出錯誤。
  const onSaveDraft = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    submitMutation.mutate({ action: 'draft', values })
  }
  const onPublish = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    modal.confirm(
      genHeaderPublishConfirm({ name: values.name }, () =>
        submitMutation.mutateAsync({ action: 'publish', values }),
      ),
    )
  }

  if (from && sourceQuery.isLoading) {
    return (
      <div className="p-16 text-center">
        <Spin />
      </div>
    )
  }

  return (
    <PageContainer
      header={{
        title: sourceTemplate ? `複製自「${sourceTemplate.name}」` : '新建頁首',
        onBack: () => navigate({ to: '/pages/header' }),
      }}
      footer={[
        <Button key="draft" loading={submitMutation.isPending} onClick={onSaveDraft}>
          儲存草稿
        </Button>,
        <Button
          key="pub"
          type="primary"
          icon={<SaveOutlined />}
          loading={submitMutation.isPending}
          onClick={onPublish}
        >
          發布
        </Button>,
      ]}
    >
      <HeaderTemplateForm
        form={form}
        initialValues={{
          name: sourceTemplate ? `${sourceTemplate.name} 副本` : '',
          content: sourceTemplate?.content ?? [],
        }}
        editorTitle="編輯頁首內容"
        previewId="new"
      />
    </PageContainer>
  )
}
