import { App, Button, Form, Spin } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { pageTitle } from '../../../../shared/head'
import { footerApi } from '../../../../service/storefront/footer'
import { FooterTemplateForm } from '../../../../components/page-template/footer/FooterTemplateForm'
import type { FooterTemplateFormValues } from '../../../../components/page-template/footer/FooterTemplateForm'
import { genFooterPublishConfirm } from '../../../../components/page-template/footer/footerPublishConfirm'

// /pages/footer/new — 新建頁尾。?from=<id> 走複製流程:載入來源當起點,按儲存草稿/發布才寫 server。
export const Route = createFileRoute('/_layout/pages/footer/new')({
  head: () => ({ meta: [{ title: pageTitle('新建頁尾') }] }),
  component: FooterNewPage,
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
})

// 一次送出兩種意圖:存草稿 or 直接發布,共用同一條建立流程。
type SubmitArgs = {
  action: 'draft' | 'publish'
  values: FooterTemplateFormValues
}

function FooterNewPage() {
  const navigate = useNavigate()
  const { from } = Route.useSearch()
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<FooterTemplateFormValues>()

  const sourceQuery = useQuery({
    queryKey: ['footer', 'template', from],
    queryFn: () => footerApi.get(from as string),
    enabled: !!from,
  })
  const sourceTemplate = from ? sourceQuery.data : undefined

  const submitMutation = useMutation({
    mutationFn: async ({ action, values }: SubmitArgs) => {
      // 一次建好(內容一併帶上),不再補一趟 save-draft。
      const created = await footerApi.create({
        name: values.name.trim(),
        content: values.content,
        copyFrom: from,
      })
      if (action === 'publish') await footerApi.publish(created.id, {})
      return { id: created.id, action }
    },
    onSuccess: ({ id, action }) => {
      message.success(action === 'publish' ? '已發布' : '已儲存草稿')
      void queryClient.invalidateQueries({ queryKey: ['footer'] })
      if (action === 'publish') navigate({ to: '/pages/footer' })
      else navigate({ to: '/pages/footer/$templateId', params: { templateId: id } })
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
      genFooterPublishConfirm({ name: values.name }, () =>
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
        title: sourceTemplate ? `複製自「${sourceTemplate.name}」` : '新建頁尾',
        onBack: () => navigate({ to: '/pages/footer' }),
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
      <FooterTemplateForm
        form={form}
        initialValues={{
          name: sourceTemplate ? `${sourceTemplate.name} 副本` : '',
          content: sourceTemplate?.content ?? [],
        }}
        editorTitle="編輯頁尾內容"
        previewId="new"
      />
    </PageContainer>
  )
}
