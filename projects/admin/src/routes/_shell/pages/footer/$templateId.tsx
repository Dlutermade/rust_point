import { App, Button, Form, Spin } from 'antd'
import { CopyOutlined, SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { footerApi } from '../../../../api/footer'
import { PageFormShell } from '../../../../page-block-editor/PageFormShell'
import type { PageFormValues } from '../../../../page-block-editor/PageFormShell'
import { StatusTag } from '../../../../page-block-editor/template-ui'
import { buildPublishConfirm } from '../../../../page-block-editor/publishConfirm'

// /pages/footer/$templateId — 編輯(草稿)或檢視(已發布,唯讀)某個頁尾,一律走表單。
export const Route = createFileRoute('/_shell/pages/footer/$templateId')({
  component: FooterEditorPage,
})

function FooterEditorPage() {
  const { templateId } = Route.useParams()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const qc = useQueryClient()
  const [form] = Form.useForm<PageFormValues>()

  const entity = useQuery({
    queryKey: ['footer', 'entity', templateId],
    queryFn: () => footerApi.get(templateId),
  })
  const readOnly = entity.data ? entity.data.status !== 'draft' : false

  const saveDraft = useMutation({
    mutationFn: (values: PageFormValues) =>
      footerApi.saveDraft(templateId, { content: values.content, name: values.name.trim() }),
    onSuccess: () => {
      message.success('已儲存草稿')
      qc.invalidateQueries({ queryKey: ['footer'] })
    },
  })
  const publish = useMutation({
    mutationFn: async (values: PageFormValues) => {
      await footerApi.saveDraft(templateId, { content: values.content, name: values.name.trim() })
      await footerApi.publish(templateId, {})
    },
    onSuccess: () => {
      message.success('已發布')
      qc.invalidateQueries({ queryKey: ['footer'] })
      navigate({ to: '/pages/footer' })
    },
  })
  const runDraft = () => form.validateFields().then((v) => saveDraft.mutate(v))
  const runPublish = () =>
    form.validateFields().then((v) => {
      modal.confirm(
        buildPublishConfirm({ name: v.name, kind: 'chrome' }, () => publish.mutateAsync(v)),
      )
    })

  if (entity.isLoading) {
    return (
      <div className="p-16 text-center">
        <Spin />
      </div>
    )
  }

  return (
    <PageFormShell
      heading={entity.data?.name ?? '頁尾'}
      statusTag={entity.data ? <StatusTag v={entity.data} /> : undefined}
      form={form}
      initialValues={{ name: entity.data?.name ?? '', content: entity.data?.content ?? [] }}
      readOnly={readOnly}
      editorTitle={entity.data?.name ?? '頁尾'}
      previewId={templateId}
      frame="footer"
      onBackToList={() => navigate({ to: '/pages/footer' })}
      footerActions={
        readOnly
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
              <Button key="draft" loading={saveDraft.isPending} onClick={runDraft}>
                儲存草稿
              </Button>,
              <Button
                key="pub"
                type="primary"
                icon={<SaveOutlined />}
                loading={publish.isPending}
                onClick={runPublish}
              >
                發布
              </Button>,
            ]
      }
    />
  )
}
