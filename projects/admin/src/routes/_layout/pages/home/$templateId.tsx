import { App, Button, Form, Space, Spin } from 'antd'
import { CopyOutlined, SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { pageTitle } from '../../../../shared/head'
import { homeApi } from '../../../../api/home'
import type { ChromeOverride, Targeting } from '../../../../api/types'
import { HomeTemplateForm } from '../../../../components/page-template/home/HomeTemplateForm'
import type { HomeTemplateFormValues } from '../../../../components/page-template/home/HomeTemplateForm'
import { HomeTargetingFields } from '../../../../components/page-template/home/HomeTargetingFields'
import { HomeChromePicker } from '../../../../components/page-template/home/HomeChromePicker'
import { StatusTag } from '../../../../components/page-template/StatusTag'
import { genHomePublishConfirm } from '../../../../components/page-template/home/homePublishConfirm'

// /pages/home/$templateId — 編輯(草稿)或檢視(已發布,唯讀)某個首頁模板,一律走表單。
export const Route = createFileRoute('/_layout/pages/home/$templateId')({
  head: () => ({ meta: [{ title: pageTitle('首頁模板內容') }] }),
  component: HomeEditorPage,
})

interface HomeFormValues extends HomeTemplateFormValues {
  targeting: Targeting
  chrome: ChromeOverride
}

function HomeEditorPage() {
  const { templateId } = Route.useParams()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<HomeFormValues>()

  const templateQuery = useQuery({
    queryKey: ['home', 'template', templateId],
    queryFn: () => homeApi.get(templateId),
  })
  const isReadOnly = templateQuery.data ? templateQuery.data.status !== 'draft' : false

  // 訂閱表單的 chrome 欄位(單一來源;只在 chrome 變時重繪,不另存 state、不用 onValuesChange)。
  const chrome = (Form.useWatch('chrome', form) as ChromeOverride | undefined) ?? {}

  const headerOptionsQuery = useQuery({
    queryKey: ['home', 'header-opts'],
    queryFn: () => homeApi.headerOptions(),
  })
  const footerOptionsQuery = useQuery({
    queryKey: ['home', 'footer-opts'],
    queryFn: () => homeApi.footerOptions(),
  })
  const headerContentQuery = useQuery({
    queryKey: ['home', 'ctx-header', chrome.headerId ?? 'default'],
    queryFn: () =>
      chrome.headerId ? homeApi.layoutContent(chrome.headerId) : homeApi.activeHeader(),
  })
  const footerContentQuery = useQuery({
    queryKey: ['home', 'ctx-footer', chrome.footerId ?? 'default'],
    queryFn: () =>
      chrome.footerId ? homeApi.layoutContent(chrome.footerId) : homeApi.activeFooter(),
  })

  // 送出前先轉換:只帶後端要的欄位,不把表單狀態原封不動丟過去。
  const transferFormValuesToDraftPatch = (values: HomeFormValues) => ({
    content: values.content,
    targeting: values.targeting,
    chrome: values.chrome,
    name: values.name.trim(),
  })

  const saveDraftMutation = useMutation({
    mutationFn: (values: HomeFormValues) =>
      homeApi.saveDraft(templateId, transferFormValuesToDraftPatch(values)),
    onSuccess: () => {
      message.success('已儲存草稿')
      void queryClient.invalidateQueries({ queryKey: ['home'] })
    },
  })
  const publishMutation = useMutation({
    mutationFn: async (values: HomeFormValues) => {
      await homeApi.saveDraft(templateId, transferFormValuesToDraftPatch(values))
      await homeApi.publish(templateId, {})
    },
    onSuccess: () => {
      message.success('已發布')
      void queryClient.invalidateQueries({ queryKey: ['home'] })
      navigate({ to: '/pages/home' })
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
      genHomePublishConfirm(
        { name: values.name, targeting: values.targeting, chrome: values.chrome },
        () => publishMutation.mutateAsync(values),
      ),
    )
  }

  const templateName = templateQuery.data?.name ?? '首頁'

  if (templateQuery.isLoading) {
    return (
      <div className="p-16 text-center">
        <Spin />
      </div>
    )
  }

  const extra = (
    <>
      <Form.Item name="targeting" label="生效設定">
        <HomeTargetingFields readOnly={isReadOnly} />
      </Form.Item>
      <Form.Item name="chrome" label="頁面外框（不選 = 站台預設）">
        <HomeChromePicker
          headerOptions={headerOptionsQuery.data ?? []}
          footerOptions={footerOptionsQuery.data ?? []}
          loadContent={homeApi.layoutContent}
          readOnly={isReadOnly}
        />
      </Form.Item>
    </>
  )

  return (
    <PageContainer
      header={{
        title: (
          <Space>
            {templateName}
            {templateQuery.data ? <StatusTag template={templateQuery.data} /> : undefined}
          </Space>
        ),
        onBack: () => navigate({ to: '/pages/home' }),
      }}
      footer={
        isReadOnly
          ? [
              <Button
                key="dup"
                type="primary"
                icon={<CopyOutlined />}
                onClick={() => navigate({ to: '/pages/home/new', search: { from: templateId } })}
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
      <HomeTemplateForm
        form={form}
        initialValues={{
          name: templateQuery.data?.name ?? '',
          targeting: templateQuery.data?.targeting ?? {},
          chrome: templateQuery.data?.chrome ?? {},
          content: templateQuery.data?.content ?? [],
        }}
        readOnly={isReadOnly}
        extraFields={extra}
        editorTitle={templateName}
        previewId={templateId}
        contextHeader={headerContentQuery.data}
        contextFooter={footerContentQuery.data}
      />
    </PageContainer>
  )
}
