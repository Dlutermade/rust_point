import { App, Button, Form, Spin } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
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
import { genHomePublishConfirm } from '../../../../components/page-template/home/homePublishConfirm'

// /pages/home/new — 新建首頁。?from=<id> 走複製流程:載入來源設定當起點,按儲存草稿/發布才寫 server。
export const Route = createFileRoute('/_layout/pages/home/new')({
  head: () => ({ meta: [{ title: pageTitle('新建首頁模板') }] }),
  component: HomeNewPage,
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
})

interface HomeFormValues extends HomeTemplateFormValues {
  targeting: Targeting
  chrome: ChromeOverride
}

// 一次送出兩種意圖:存草稿 or 直接發布,共用同一條建立流程。
type SubmitArgs = {
  action: 'draft' | 'publish'
  values: HomeFormValues
}

function HomeNewPage() {
  const navigate = useNavigate()
  const { from } = Route.useSearch()
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<HomeFormValues>()
  // 訂閱表單的 chrome 欄位(單一來源;只在 chrome 變時重繪,不另存 state、不用 onValuesChange)。
  const chrome = (Form.useWatch('chrome', form) as ChromeOverride | undefined) ?? {}

  // 複製來源(只有 ?from 時抓)。
  const sourceQuery = useQuery({
    queryKey: ['home', 'template', from],
    queryFn: () => homeApi.get(from as string),
    enabled: !!from,
  })
  const sourceTemplate = from ? sourceQuery.data : undefined

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

  const submitMutation = useMutation({
    mutationFn: async ({ action, values }: SubmitArgs) => {
      const created = await homeApi.createDraft(values.name.trim())
      await homeApi.saveDraft(created.id, {
        content: values.content,
        targeting: values.targeting,
        chrome: values.chrome,
      })
      if (action === 'publish') await homeApi.publish(created.id, {})
      return { id: created.id, action }
    },
    onSuccess: ({ id, action }) => {
      message.success(action === 'publish' ? '已發布' : '已儲存草稿')
      void queryClient.invalidateQueries({ queryKey: ['home'] })
      if (action === 'publish') navigate({ to: '/pages/home' })
      else navigate({ to: '/pages/home/$templateId', params: { templateId: id } })
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
      genHomePublishConfirm(
        { name: values.name, targeting: values.targeting, chrome: values.chrome },
        () => submitMutation.mutateAsync({ action: 'publish', values }),
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

  const extra = (
    <>
      <Form.Item name="targeting" label="生效設定">
        <HomeTargetingFields />
      </Form.Item>
      <Form.Item name="chrome" label="頁面外框（不選 = 站台預設）">
        <HomeChromePicker
          headerOptions={headerOptionsQuery.data ?? []}
          footerOptions={footerOptionsQuery.data ?? []}
          loadContent={homeApi.layoutContent}
        />
      </Form.Item>
    </>
  )

  return (
    <PageContainer
      header={{
        title: sourceTemplate ? `複製自「${sourceTemplate.name}」` : '新建首頁模板',
        onBack: () => navigate({ to: '/pages/home' }),
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
      <HomeTemplateForm
        form={form}
        initialValues={{
          name: sourceTemplate ? `${sourceTemplate.name} 副本` : '',
          targeting: sourceTemplate?.targeting ?? {},
          chrome: sourceTemplate?.chrome ?? {},
          content: sourceTemplate?.content ?? [],
        }}
        extraFields={extra}
        editorTitle="編輯首頁內容"
        previewId="new"
        contextHeader={headerContentQuery.data}
        contextFooter={footerContentQuery.data}
      />
    </PageContainer>
  )
}
