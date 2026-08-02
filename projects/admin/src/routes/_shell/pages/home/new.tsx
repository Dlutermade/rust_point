import { App, Button, Form, Spin } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { homeApi } from '../../../../api/home'
import type { ChromeOverride, Targeting } from '../../../../api/types'
import { PageFormShell } from '../../../../page-block-editor/PageFormShell'
import type { PageFormValues } from '../../../../page-block-editor/PageFormShell'
import { TargetingFields } from '../../../../page-block-editor/TargetingFields'
import { ChromePicker } from '../../../../page-block-editor/ChromePicker'
import { buildPublishConfirm } from '../../../../page-block-editor/publishConfirm'

// /pages/home/new — 新建首頁。?from=<id> 走複製流程:載入來源設定當起點,按儲存草稿/發布才寫 server。
export const Route = createFileRoute('/_shell/pages/home/new')({
  component: HomeNewPage,
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
})

interface HomeFormValues extends PageFormValues {
  targeting: Targeting
  chrome: ChromeOverride
}

function HomeNewPage() {
  const navigate = useNavigate()
  const { from } = Route.useSearch()
  const { message, modal } = App.useApp()
  const qc = useQueryClient()
  const [form] = Form.useForm<HomeFormValues>()
  // 訂閱表單的 chrome 欄位(單一來源;只在 chrome 變時重繪,不另存 state、不用 onValuesChange)。
  const chrome = (Form.useWatch('chrome', form) as ChromeOverride | undefined) ?? {}

  // 複製來源(只有 ?from 時抓)。
  const source = useQuery({
    queryKey: ['home', 'entity', from],
    queryFn: () => homeApi.get(from as string),
    enabled: !!from,
  })
  const src = from ? source.data : undefined

  const headerOpts = useQuery({
    queryKey: ['home', 'header-opts'],
    queryFn: () => homeApi.headerOptions(),
  })
  const footerOpts = useQuery({
    queryKey: ['home', 'footer-opts'],
    queryFn: () => homeApi.footerOptions(),
  })
  const header = useQuery({
    queryKey: ['home', 'ctx-header', chrome.headerId ?? 'default'],
    queryFn: () =>
      chrome.headerId ? homeApi.layoutContent(chrome.headerId) : homeApi.activeHeader(),
  })
  const footer = useQuery({
    queryKey: ['home', 'ctx-footer', chrome.footerId ?? 'default'],
    queryFn: () =>
      chrome.footerId ? homeApi.layoutContent(chrome.footerId) : homeApi.activeFooter(),
  })

  const submit = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: 'draft' | 'publish'
      values: HomeFormValues
    }) => {
      const t = await homeApi.createDraft(values.name.trim())
      await homeApi.saveDraft(t.id, {
        content: values.content,
        targeting: values.targeting,
        chrome: values.chrome,
      })
      if (action === 'publish') await homeApi.publish(t.id, {})
      return { id: t.id, action }
    },
    onSuccess: ({ id, action }) => {
      message.success(action === 'publish' ? '已發布' : '已儲存草稿')
      qc.invalidateQueries({ queryKey: ['home'] })
      if (action === 'publish') navigate({ to: '/pages/home' })
      else navigate({ to: '/pages/home/$templateId', params: { templateId: id } })
    },
  })
  const runDraft = () =>
    form.validateFields().then((values) => submit.mutate({ action: 'draft', values }))
  const runPublish = () =>
    form.validateFields().then((values) => {
      modal.confirm(
        buildPublishConfirm(
          { name: values.name, targeting: values.targeting, chrome: values.chrome, kind: 'page' },
          () => submit.mutateAsync({ action: 'publish', values }),
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

  const extra = (
    <>
      <Form.Item name="targeting" label="生效設定">
        <TargetingFields />
      </Form.Item>
      <Form.Item name="chrome" label="頁面外框（不選 = 站台預設）">
        <ChromePicker
          headerOptions={headerOpts.data ?? []}
          footerOptions={footerOpts.data ?? []}
          loadContent={homeApi.layoutContent}
        />
      </Form.Item>
    </>
  )

  return (
    <PageFormShell
      heading={src ? `複製自「${src.name}」` : '新建首頁模板'}
      form={form}
      initialValues={{
        name: src ? `${src.name} 副本` : '',
        targeting: src?.targeting ?? {},
        chrome: src?.chrome ?? {},
        content: src?.content ?? [],
      }}
      extraFields={extra}
      editorTitle="編輯首頁內容"
      previewId="new"
      contextHeader={header.data}
      contextFooter={footer.data}
      onBackToList={() => navigate({ to: '/pages/home' })}
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
