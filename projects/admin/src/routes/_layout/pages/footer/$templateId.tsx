import { App, Button, Form, Space, Spin } from 'antd'
import { CopyOutlined, SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { pageTitle } from '../../../../shared/head'
import { footerApi } from '../../../../api/footer'
import { FooterTemplateForm } from '../../../../components/page-template/footer/FooterTemplateForm'
import type { FooterTemplateFormValues } from '../../../../components/page-template/footer/FooterTemplateForm'
import { StatusTag } from '../../../../components/page-template/StatusTag'
import { genFooterPublishConfirm } from '../../../../components/page-template/footer/footerPublishConfirm'

// /pages/footer/$templateId — 編輯(草稿)或檢視(已發布,唯讀)某個頁尾,一律走表單。
export const Route = createFileRoute('/_layout/pages/footer/$templateId')({
  head: () => ({ meta: [{ title: pageTitle('頁尾內容') }] }),
  component: FooterEditorPage,
})

function FooterEditorPage() {
  const { templateId } = Route.useParams()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<FooterTemplateFormValues>()

  const templateQuery = useQuery({
    queryKey: ['footer', 'template', templateId],
    queryFn: () => footerApi.get(templateId),
  })
  const isReadOnly = templateQuery.data ? templateQuery.data.status !== 'draft' : false

  // 送出前先轉換:只帶後端要的欄位,不把表單狀態原封不動丟過去。
  const transferFormValuesToDraftPatch = (values: FooterTemplateFormValues) => ({
    content: values.content,
    name: values.name.trim(),
  })

  const saveDraftMutation = useMutation({
    mutationFn: (values: FooterTemplateFormValues) =>
      footerApi.saveDraft(templateId, transferFormValuesToDraftPatch(values)),
    onSuccess: () => {
      message.success('已儲存草稿')
      void queryClient.invalidateQueries({ queryKey: ['footer'] })
    },
  })
  const publishMutation = useMutation({
    mutationFn: async (values: FooterTemplateFormValues) => {
      await footerApi.saveDraft(templateId, transferFormValuesToDraftPatch(values))
      await footerApi.publish(templateId, {})
    },
    onSuccess: () => {
      message.success('已發布')
      void queryClient.invalidateQueries({ queryKey: ['footer'] })
      navigate({ to: '/pages/footer' })
    },
  })
  // validateFields() 驗證失敗會 reject —— 用 catch 收掉,antd 已在欄位上標出錯誤。
  const onSaveDraft = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    saveDraftMutation.mutate(values)
  }
  const onPublish = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    modal.confirm(
      genFooterPublishConfirm({ name: values.name }, () => publishMutation.mutateAsync(values)),
    )
  }

  const templateName = templateQuery.data?.name ?? '頁尾'

  if (templateQuery.isLoading) {
    return (
      <div className="p-16 text-center">
        <Spin />
      </div>
    )
  }

  return (
    <PageContainer
      header={{
        title: (
          <Space>
            {templateName}
            {templateQuery.data ? <StatusTag template={templateQuery.data} /> : undefined}
          </Space>
        ),
        onBack: () => navigate({ to: '/pages/footer' }),
      }}
      footer={
        isReadOnly
          ? [
              <Button
                key="dup"
                type="primary"
                icon={<CopyOutlined />}
                onClick={() => navigate({ to: '/pages/footer/new', search: { from: templateId } })}
              >
                複製一份來編輯
              </Button>,
            ]
          : [
              <Button key="draft" loading={saveDraftMutation.isPending} onClick={onSaveDraft}>
                儲存草稿
              </Button>,
              <Button
                key="pub"
                type="primary"
                icon={<SaveOutlined />}
                loading={publishMutation.isPending}
                onClick={onPublish}
              >
                發布
              </Button>,
            ]
      }
    >
      <FooterTemplateForm
        form={form}
        initialValues={{
          name: templateQuery.data?.name ?? '',
          content: templateQuery.data?.content ?? [],
        }}
        readOnly={isReadOnly}
        editorTitle={templateName}
        previewId={templateId}
      />
    </PageContainer>
  )
}
