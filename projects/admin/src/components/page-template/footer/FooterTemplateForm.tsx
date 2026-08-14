import type { ReactNode } from 'react'
import { ProCard, ProForm, ProFormText } from '@ant-design/pro-components'
import { Form } from 'antd'
import type { FormInstance } from 'antd'
import type { BlockInstance } from '../../../service/storefront/shared/types'
import { ContentField } from '../../block-editor/ContentField'

// 頁尾模板表單。頁尾是外框:沒有生效條件、沒有外框覆寫、預覽不需要疊上下文,
// 所以 props 只留這幾個 —— 不從首頁那份複製一堆用不到的欄位。
export interface FooterTemplateFormValues {
  name: string
  content: BlockInstance[]
  [key: string]: unknown
}

type FooterTemplateFormProps = {
  form: FormInstance
  initialValues: FooterTemplateFormValues
  readOnly?: boolean
  extraFields?: ReactNode
  editorTitle: string
  previewId?: string
}

export function FooterTemplateForm({
  form,
  initialValues,
  readOnly,
  extraFields,
  editorTitle,
  previewId,
}: FooterTemplateFormProps) {
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
            placeholder="例：雙11 版 / 促銷頁尾"
            rules={[{ required: true, message: '請輸入名稱' }]}
          />
          {extraFields}
        </ProCard>

        <ProCard title="頁尾內容">
          <Form.Item name="content" noStyle>
            <ContentField
              editorTitle={editorTitle}
              previewId={previewId}
              readOnly={readOnly}
              frame="footer"
            />
          </Form.Item>
        </ProCard>
      </div>
    </ProForm>
  )
}
