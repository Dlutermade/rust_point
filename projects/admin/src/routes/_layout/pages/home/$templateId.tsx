import { App, Button, Form, Space, Spin } from 'antd'
import { CopyOutlined, SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { pageTitle } from '../../../../shared/head'
import { homePageApi } from '../../../../service/storefront/home-page'
import type { HomePagePatch, Targeting } from '../../../../service/storefront/home-page'
import { headerApi } from '../../../../service/storefront/header'
import { footerApi } from '../../../../service/storefront/footer'
import { HomeTemplateForm } from '../../../../components/page-template/home/HomeTemplateForm'
import type { HomeTemplateFormValues } from '../../../../components/page-template/home/HomeTemplateForm'
import type { ChromeSelection } from '../../../../components/page-template/home/HomeChromePicker'
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
  /** 表單裡外框仍是「一對」(picker 的形狀);送出時展開成兩個平欄位。 */
  chrome: ChromeSelection
}

function HomeEditorPage() {
  const { templateId } = Route.useParams()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<HomeFormValues>()

  const templateQuery = useQuery({
    queryKey: ['home-page', 'entity', templateId],
    queryFn: () => homePageApi.get(templateId),
  })
  const isReadOnly = templateQuery.data ? templateQuery.data.status !== 'draft' : false

  // 訂閱表單的 chrome 欄位(單一來源;只在 chrome 變時重繪,不另存 state、不用 onValuesChange)。
  const chrome = (Form.useWatch('chrome', form) as ChromeSelection | undefined) ?? {}

  const headerOptionsQuery = useQuery({ queryKey: ['header', 'list'], queryFn: headerApi.list })
  const footerOptionsQuery = useQuery({ queryKey: ['footer', 'list'], queryFn: footerApi.list })
  // 沒指定覆寫就疊站台預設 —— 那是頁首 / 頁尾自己的資料,由它們各自的 API 提供。
  const headerContentQuery = useQuery({
    queryKey: ['header', 'content', chrome.headerTemplateId ?? 'site-default'],
    queryFn: () =>
      chrome.headerTemplateId
        ? headerApi.content(chrome.headerTemplateId)
        : headerApi.siteDefaultContent(),
  })
  const footerContentQuery = useQuery({
    queryKey: ['footer', 'content', chrome.footerTemplateId ?? 'site-default'],
    queryFn: () =>
      chrome.footerTemplateId
        ? footerApi.content(chrome.footerTemplateId)
        : footerApi.siteDefaultContent(),
  })

  // 送出前先轉換:只帶後端要的欄位,不把表單狀態原封不動丟過去。
  // 外框在表單裡是一對,到這裡展開成兩個平欄位(後端是兩個獨立 FK)。
  // 沒選 → 送 null 表示「清空覆寫,改回跟隨站台預設」,而不是省略(那是「不動」)。
  const transferFormValuesToPatch = (values: HomeFormValues): HomePagePatch => ({
    name: values.name.trim(),
    content: values.content,
    targeting: values.targeting,
    headerTemplateId: values.chrome?.headerTemplateId ?? null,
    footerTemplateId: values.chrome?.footerTemplateId ?? null,
  })

  const saveDraftMutation = useMutation({
    mutationFn: (values: HomeFormValues) =>
      homePageApi.saveDraft(templateId, transferFormValuesToPatch(values)),
    onSuccess: () => {
      message.success('已儲存草稿')
      void queryClient.invalidateQueries({ queryKey: ['home-page'] })
    },
  })
  const publishMutation = useMutation({
    // 一次打完。publish 吃的 patch 跟草稿一樣,所以不必先繞一趟 saveDraft ——
    // 那樣不原子,而且每次發布都會多灌一筆 save-draft 審計。
    mutationFn: (values: HomeFormValues) =>
      homePageApi.publish(templateId, transferFormValuesToPatch(values)),
    onSuccess: () => {
      message.success('已發布')
      void queryClient.invalidateQueries({ queryKey: ['home-page'] })
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
        {
          name: values.name,
          targeting: values.targeting,
          headerTemplateId: values.chrome?.headerTemplateId,
          footerTemplateId: values.chrome?.footerTemplateId,
        },
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
          loadContent={headerApi.content}
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
            {templateQuery.data ? <StatusTag status={templateQuery.data.status} /> : undefined}
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
          chrome: {
            headerTemplateId: templateQuery.data?.headerTemplateId,
            footerTemplateId: templateQuery.data?.footerTemplateId,
          },
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
