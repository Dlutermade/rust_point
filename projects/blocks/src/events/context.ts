// 頁面/租戶脈絡:從 SSR 內嵌 JSON 灌一次(權威、Node-free);router 併進每顆事件。
// 尤其 templateVariant → 多模板 A/B 歸因天生成立。
export interface SfContext {
  tenantId?: string
  pageType?: string
  templateVariant?: string
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
