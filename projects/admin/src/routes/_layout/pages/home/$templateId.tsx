import { App, Button, Form, Spin } from 'antd'
import { CopyOutlined, SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { homeApi } from '../../../../api/home'
import type { ChromeOverride, Targeting } from '../../../../api/types'
import { PageFormShell } from '../../../../components/page-template/PageFormShell'
import type { PageFormValues } from '../../../../components/page-template/PageFormShell'
import { TargetingFields } from '../../../../components/page-template/TargetingFields'
import { ChromePicker } from '../../../../components/page-template/ChromePicker'
import { StatusTag } from '../../../../components/page-template/StatusTag'
import { buildPublishConfirm } from '../../../../components/page-template/publishConfirm'

// /pages/home/$templateId — 編輯(草稿)或檢視(已發布,唯讀)某個首頁模板,一律走表單。
export const Route = createFileRoute('/_layout/pages/home/$templateId')({
  component: HomeEditorPage,
})

interface HomeFormValues extends PageFormValues {
  targeting: Targeting
  chrome: ChromeOverride
}

function HomeEditorPage() {
  const { templateId } = Route.useParams()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const qc = useQueryClient()
  const [form] = Form.useForm<HomeFormValues>()

  const entity = useQuery({
    queryKey: ['home', 'entity', templateId],
    queryFn: () => homeApi.get(templateId),
  })
  const readOnly = entity.data ? entity.data.status !== 'draft' : false

  // 訂閱表單的 chrome 欄位(單一來源;只在 chrome 變時重繪,不另存 state、不用 onValuesChange)。
  const chrome = (Form.useWatch('chrome', form) as ChromeOverride | undefined) ?? {}

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

  const saveDraft = useMutation({
    mutationFn: (values: HomeFormValues) =>
      homeApi.saveDraft(templateId, {
        content: values.content,
        targeting: values.targeting,
        chrome: values.chrome,
        name: values.name.trim(),
      }),
    onSuccess: () => {
      message.success('已儲存草稿')
      qc.invalidateQueries({ queryKey: ['home'] })
    },
  })
  const publish = useMutation({
    mutationFn: async (values: HomeFormValues) => {
      await homeApi.saveDraft(templateId, {
        content: values.content,
        targeting: values.targeting,
        chrome: values.chrome,
        name: values.name.trim(),
      })
      await homeApi.publish(templateId, {})
    },
    onSuccess: () => {
      message.success('已發布')
      qc.invalidateQueries({ queryKey: ['home'] })
      navigate({ to: '/pages/home' })
    },
  })
  const runDraft = () => form.validateFields().then((v) => saveDraft.mutate(v))
  const runPublish = () =>
    form.validateFields().then((v) => {
      modal.confirm(
        buildPublishConfirm(
          { name: v.name, targeting: v.targeting, chrome: v.chrome, kind: 'page' },
          () => publish.mutateAsync(v),
        ),
      )
    })

  if (entity.isLoading) {
    return (
      <div className="p-16 text-center">
        <Spin />
      </div>
    )
  }

  const extra = (
    <>
      <Form.Item name="targeting" label="生效設定">
        <TargetingFields readOnly={readOnly} />
      </Form.Item>
      <Form.Item name="chrome" label="頁面外框（不選 = 站台預設）">
        <ChromePicker
          headerOptions={headerOpts.data ?? []}
          footerOptions={footerOpts.data ?? []}
          loadContent={homeApi.layoutContent}
          readOnly={readOnly}
        />
      </Form.Item>
    </>
  )

  return (
    <PageFormShell
      heading={entity.data?.name ?? '首頁'}
      statusTag={entity.data ? <StatusTag v={entity.data} /> : undefined}
      form={form}
      initialValues={{
        name: entity.data?.name ?? '',
        targeting: entity.data?.targeting ?? {},
        chrome: entity.data?.chrome ?? {},
        content: entity.data?.content ?? [],
      }}
      readOnly={readOnly}
      extraFields={extra}
      editorTitle={entity.data?.name ?? '首頁'}
      previewId={templateId}
      contextHeader={header.data}
      contextFooter={footer.data}
      onBackToList={() => navigate({ to: '/pages/home' })}
      footerActions={
        readOnly
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
