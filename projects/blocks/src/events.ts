// 統一事件路由脊椎。區塊發語義事件(命名仿 GA4);宿主裝「一個」router,
// router 有 execute(命令→行為)+ sinks(觀察→追蹤目的地 fan-out)。
// 同一手勢 → 一個事件 → 同時 execute + 送所有 sinks;命令型才 execute,全部都追蹤。

export interface SfEvent {
  /** GA4 風格事件名(見 SF_EVENTS):add_to_cart / view_promotion / begin_checkout / block_hover … */
  name: string
  /** GA4 風格參數:item_id / promotion_id / value / currency … */
  params?: Record<string, unknown>
  /** 觸發區塊(型別/id),用於歸因與 A/B。 */
  source: string
}

// 權威事件名目錄(仿 GA4),一處定義、避免字串漂移(學 Dawn PUB_SUB_EVENTS / Web Pixels 目錄)。
export const SF_EVENTS = {
  pageView: 'page_view',
  viewPromotion: 'view_promotion',
  selectPromotion: 'select_promotion',
  viewItemList: 'view_item_list',
  selectItem: 'select_item',
  addToCart: 'add_to_cart',
  removeFromCart: 'remove_from_cart',
  addToWishlist: 'add_to_wishlist',
  beginCheckout: 'begin_checkout',
  viewCart: 'view_cart',
  login: 'login',
  blockHover: 'block_hover',
} as const

export type SfEventName = (typeof SF_EVENTS)[keyof typeof SF_EVENTS]

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

// 送到 sink 的信封:事件 + 當下 context。
export interface SfEventEnvelope {
  event: SfEvent
  context: Readonly<SfContext>
}

export const SF_EVENT = 'sf-event'

// composed 讓事件穿出 Shadow DOM,冒泡到宿主根。
export function emitEvent(el: HTMLElement, event: SfEvent): void {
  el.dispatchEvent(
    new CustomEvent<SfEvent>(SF_EVENT, {
      detail: event,
      bubbles: true,
      composed: true,
    }),
  )
}

// sink:一個追蹤目的地(自家 collector / GA4 / Meta / 編輯器 console)。可插拔、可多個。
export type SfSink = (envelope: SfEventEnvelope) => void

export interface EventRouter {
  /** 命令型事件 → 執行行為(導頁 / 彈 mini-cart …)。純觀察事件不動它。 */
  execute?: (event: SfEvent, context: Readonly<SfContext>) => void
  /** 追蹤目的地,所有事件都 fan-out;各自批次/上報、不擋互動。 */
  sinks?: SfSink[]
}

// 宿主(前台 runtime / 編輯器)裝一個路由,回傳解除函式。
export function installEventRouter(
  target: EventTarget,
  router: EventRouter,
): () => void {
  const handler = (ev: Event) => {
    const event = (ev as CustomEvent<SfEvent>).detail
    const context = getContext()
    router.execute?.(event, context)
    if (router.sinks && router.sinks.length > 0) {
      const envelope: SfEventEnvelope = { event, context }
      for (const sink of router.sinks) sink(envelope)
    }
  }
  target.addEventListener(SF_EVENT, handler)
  return () => target.removeEventListener(SF_EVENT, handler)
}

// 編輯器用的 sink:印出來、不真上報,用來看事件有沒有正確發。
export const consoleSink: SfSink = ({ event, context }) => {
  console.debug('[sf-track]', event.name, event.params ?? {}, context)
}
