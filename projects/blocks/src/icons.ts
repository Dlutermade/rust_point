import { html } from 'lit'
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'
import type { TemplateResult } from 'lit'

// 前台區塊(WC)自帶的 inline SVG icon set —— 不吃 @ant-design/icons(那是後台的)。
// Feather 風格:24×24、stroke=currentColor、無填色 → 大小/顏色由 CSS 控。

export type IconName =
  | 'cart' | 'bag' | 'user' | 'search' | 'heart' | 'menu' | 'close'
  | 'chevron-right' | 'chevron-down' | 'arrow-right'
  | 'plus' | 'minus' | 'star' | 'phone' | 'mail' | 'map-pin'

const PATHS: Record<IconName, string> = {
  'cart': '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  'bag': '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  'user': '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  'heart': '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
  'menu': '<path d="M3 12h18M3 6h18M3 18h18"/>',
  'close': '<path d="M18 6 6 18M6 6l12 12"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
  'plus': '<path d="M12 5v14M5 12h14"/>',
  'minus': '<path d="M5 12h14"/>',
  'star': '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01z"/>',
  'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  'mail': '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  'map-pin': '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[]

// 中文標籤,給編輯器下拉選單。
export const ICON_LABELS: Record<IconName, string> = {
  'cart': '購物車', 'bag': '購物袋', 'user': '會員', 'search': '搜尋', 'heart': '收藏',
  'menu': '選單', 'close': '關閉', 'chevron-right': '右箭頭', 'chevron-down': '下箭頭',
  'arrow-right': '箭頭', 'plus': '加', 'minus': '減', 'star': '星', 'phone': '電話',
  'mail': '信箱', 'map-pin': '地標',
}

export function renderIcon(name: IconName, size = 24, stroke = 1.75): TemplateResult {
  const path = PATHS[name] ?? PATHS.star
  return html`<svg
    viewBox="0 0 24 24" width=${size} height=${size}
    fill="none" stroke="currentColor" stroke-width=${stroke}
    stroke-linecap="round" stroke-linejoin="round"
  >${unsafeSVG(path)}</svg>`
}
