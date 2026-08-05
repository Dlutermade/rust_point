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
