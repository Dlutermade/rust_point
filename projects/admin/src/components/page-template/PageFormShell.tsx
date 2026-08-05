import type { ReactNode } from 'react'
import { PageContainer, ProCard, ProForm, ProFormText } from '@ant-design/pro-components'
import { Form, Space } from 'antd'
import type { FormInstance } from 'antd'
import type { BlockInstance } from '../../api/types'
import { ContentField } from '../block-editor/ContentField'

// 頁面表單外殼(Pro):PageContainer(標題 + 底部 FooterToolbar)+ ProForm(表單 store)+ ProCard。
// 名稱用 ProFormText;其餘欄位(生效/外框)由呼叫者用 extraFields 塞;內容用 ProForm.Item 綁 ContentField。
// 動作(儲存草稿/發布/唯讀標籤)由呼叫者透過 footerActions 給 —— 外殼不認得,資料由路由檔自己扛。
export interface PageFormValues {
  name: string
  content: BlockInstance[]
  [key: string]: unknown
}

export function PageFormShell({
  heading,
  statusTag,
  form,
  initialValues,
  readOnly,
  extraFields,
  editorTitle,
  previewId,
  contextHeader,
  contextFooter,
  frame,
  onBackToList,
  footerActions,
}: {
  heading: string
  statusTag?: ReactNode
  form: FormInstance
  initialValues: PageFormValues
  readOnly?: boolean
  extraFields?: ReactNode
  editorTitle: string
  previewId?: string
  contextHeader?: BlockInstance[]
  contextFooter?: BlockInstance[]
  frame?: 'page' | 'header' | 'footer'
  onBackToList: () => void
  footerActions: ReactNode[]
}) {
  return (
    <PageContainer
      header={{
        title: (
          <Space>
            {heading}
            {statusTag}
          </Space>
        ),
        onBack: onBackToList,
      }}
      footer={footerActions}
    >
      <ProForm form={form} initialValues={initialValues} submitter={false} layout="vertical">
        {/* 卡片間距統一走 8/16/32 規範:此處 gap-4 = 16px,單一來源不與卡片預設 margin 疊加。 */}
        <div className="flex flex-col gap-4">
          <ProCard title="基本設定">
            <ProFormText
              name="name"
              label="名稱"
              width="lg"
              disabled={readOnly}
              placeholder="例：雙11 版 / 促銷頁首"
              rules={[{ required: true, message: '請輸入名稱' }]}
            />
            {extraFields}
          </ProCard>

          <ProCard title="頁面內容">
            <Form.Item name="content" noStyle>
              <ContentField
                editorTitle={editorTitle}
                previewId={previewId}
                readOnly={readOnly}
                contextHeader={contextHeader}
                contextFooter={contextFooter}
                frame={frame}
              />
            </Form.Item>
          </ProCard>
        </div>
      </ProForm>
    </PageContainer>
  )
}
