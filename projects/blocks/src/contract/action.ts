// 區塊「動作意圖」——商家在編輯器配置一顆按鈕/點擊「想幹嘛」。
// 點擊時區塊發一個語義事件(名 = kind,仿 GA4),走統一 event-routing;
// 由宿主 router 的 execute 面向解讀執行(見 ../events)。
// 關鍵:動作與行為解耦——「加入購物車」會彈 mini-cart 而非導頁,
// 這種非導頁動作用 href 表達不了,所以動作必須是意圖、由 router 決定。
// kind 對齊 GA4 事件語彙,讓 track 面向近乎直通 GA4 報表。
export type BlockActionKind =
  | 'none'
  | 'navigate' // params.href;追蹤記為 select_promotion
  | 'begin_checkout'
  | 'add_to_cart' // 彈 mini-cart,不導頁
  | 'view_cart' // 開抽屜,不導頁
  | 'login'
  | 'view_category' // params.categoryId

export interface BlockAction {
  kind: BlockActionKind
  /** 依 kind 帶參數:navigate→{href}、category→{categoryId}、add-to-cart→{productId} … */
  params?: Record<string, string>
  newTab?: boolean
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
