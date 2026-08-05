// 一個「區塊型別」= 型別 id + 名稱 + 自訂元素標籤 + schema(欄位)+ 預設值。
// 編輯器靠 schema 生設定表單,WC 靠同一份 defaults 渲染 —— 共同來源就在這。

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number' // 滑桿 + 數字(高度…)
  | 'spacing' // X/Y 兩軸(gap / padding)
  | 'color'
  | 'image'
  | 'url'
  | 'select'
  | 'boolean'
  | 'action'

export interface SelectOption {
  label: string
  value: string
}

export interface BlockField {
  key: string
  label: string
  type: FieldType
  options?: SelectOption[]
  placeholder?: string
  /** number 型別:滑桿範圍 / 級距 */
  min?: number
  max?: number
  step?: number
  /** 條件顯示:僅當另一欄位符合時才出現(給「開關 → 展開細節」用)。
   *  有 equals → 值相等才顯示;無 equals → 該欄位為真值才顯示。 */
  showIf?: { key: string; equals?: unknown }
}

export interface BlockSchema {
  fields: BlockField[]
}

export interface BlockType {
  type: string
  name: string
  tag: string
  schema: BlockSchema
  defaults: Record<string, unknown>
  /** 可否容納子區塊(container 類)。 */
  container?: boolean
}
