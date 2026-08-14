// 頁面/租戶脈絡:從 SSR 內嵌 JSON 灌一次(權威、Node-free);router 併進每顆事件。
// 尤其 templateId → 多模板 A/B 歸因天生成立(同一版位多份模板,事件自帶是哪一份)。
export interface SfContext {
  tenantId?: string
  /** 這一頁是哪種模板算出來的:home / header / footer(未來 product / landing)。 */
  pageType?: string
  templateId?: string
  locale?: string
  url?: string
  [key: string]: unknown
}

let currentContext: Readonly<SfContext> = Object.freeze({})

export function setContext(ctx: SfContext): void {
  currentContext = Object.freeze({ ...ctx })
}

export function getContext(): Readonly<SfContext> {
  return currentContext
}
