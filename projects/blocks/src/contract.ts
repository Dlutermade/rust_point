// 區塊契約:編輯器設定表單 與 WC 渲染 的共同來源。
// 一個「區塊型別」= 型別 id + 名稱 + 自訂元素標籤 + schema(欄位)+ 預設值。

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number' // 滑桿 + 數字(高度…)
  | 'spacing' // X/Y 兩軸(gap / padding)
  | 'color' // 顏色選擇器
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
  showIf?: { key: string, equals?: unknown }
}

// 區塊「動作意圖」——商家在編輯器配置一顆按鈕/點擊「想幹嘛」。
// 點擊時區塊發一個語義事件(名 = kind,仿 GA4),走統一 event-routing;
// 由宿主 router 的 execute 面向解讀執行(見 events.ts)。
// 關鍵:動作與行為解耦——「加入購物車」會彈 mini-cart 而非導頁,
// 這種非導頁動作用 href 表達不了,所以動作必須是意圖、由 router 決定。
// kind 對齊 GA4 事件語彙,讓 track 面向近乎直通 GA4 報表。
export type BlockActionKind =
  | 'none'
  | 'navigate' // 導向連結(params.href);追蹤記為 select_promotion
  | 'begin_checkout' // 前往結帳
  | 'add_to_cart' // 加入購物車(彈 mini-cart,不導頁)
  | 'view_cart' // 開購物車抽屜
  | 'login' // 開登入
  | 'view_category' // 前往分類(params.categoryId)

export interface BlockAction {
  kind: BlockActionKind
  /** 依 kind 帶參數:navigate→{href}、category→{categoryId}、add-to-cart→{productId} … */
  params?: Record<string, string>
  newTab?: boolean
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

// 純導航(有 URL)→ 區塊渲染真正的 <a href>(SEO 可爬、支援新分頁/中鍵/右鍵、無 JS 也能走);
// 其他行為(加入購物車/開登入…)→ <button> 發事件。這是 SEO 的關鍵區別。
// 回傳 href 表示「該用 <a>」;undefined 表示「該用 <button>」。
export function actionHref(action?: BlockAction): string | undefined {
  if (!action) return undefined
  if (action.kind === 'navigate') return action.params?.href
  // 未來:view_category / 商品連結等,由編輯器/引擎解析成 href 後也走這條。
  return undefined
}

// 兩軸間距/內距(X 水平、Y 垂直)。相容舊的單一數值。
export interface Spacing {
  x: number
  y: number
}

export function toSpacing(v: unknown, def = 0): Spacing {
  if (typeof v === 'number') return { x: v, y: v }
  if (v && typeof v === 'object') {
    const o = v as { x?: number, y?: number }
    return { x: Number(o.x) || 0, y: Number(o.y) || 0 }
  }
  return { x: def, y: def }
}
