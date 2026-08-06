import type { ReactNode } from 'react'
import { ProCard, ProForm, ProFormText } from '@ant-design/pro-components'
import { Form } from 'antd'
import type { FormInstance } from 'antd'
import type { BlockInstance } from '../../../api/types'
import { ContentField } from '../../block-editor/ContentField'

// 首頁模板表單:ProForm(表單 store)+ 欄位排版。
// 首頁專屬 —— 生效條件 / 外框覆寫由 extraFields 塞進來,內容預覽要疊上外框上下文。
// 名稱用 ProFormText;其餘欄位(生效 / 外框)由呼叫者用 extraFields 塞;內容用 ProForm.Item 綁 ContentField。
//
// 頁面外殼(PageContainer 的標題 / 返回 / 底部動作)不在這裡 —— 那是「頁面」的職責,由 route 自己組。
export interface HomeTemplateFormValues {
  name: string
  content: BlockInstance[]
  [key: string]: unknown
}

type HomeTemplateFormProps = {
  form: FormInstance
  initialValues: HomeTemplateFormValues
  readOnly?: boolean
  extraFields?: ReactNode
  editorTitle: string
  previewId?: string
  contextHeader?: BlockInstance[]
  contextFooter?: BlockInstance[]
}

export function HomeTemplateForm({
  form,
  initialValues,
  readOnly,
  extraFields,
  editorTitle,
  previewId,
  contextHeader,
  contextFooter,
}: HomeTemplateFormProps) {
  return (
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
              frame="page"
            />
          </Form.Item>
        </ProCard>
      </div>
    </ProForm>
  )
}
