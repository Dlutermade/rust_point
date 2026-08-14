// 前台中心 mock 的共用狀態。檔名不是 *.mock.ts,所以不會被當成端點定義,只供 import。
//
// 這裡刻意**模擬後端的狀態機**(已發布凍結、常態版不可暫停 / 刪除、站台預設唯一),
// 不只是回假資料 —— mock 若比真後端寬鬆,前端就會寫出上線才爆的程式碼。
// 規則與 projects/storefront-center/src/store/memory.rs 對齊。
//
// 資料只在記憶體:dev server 重啟即重置。舊版 mock 存 localStorage,
// 但 mock 現在跑在 node 端(dev server),沒有 localStorage 可用。

import type { MockResponse } from 'vite-plugin-mock-dev-server'
import type {
  AuditAction,
  AuditEntry,
  BlockInstance,
  DeviceVisibility,
  PerDevice,
} from '../../src/service/storefront/shared/types'
import type { HomePageTemplate } from '../../src/service/storefront/home-page/types'
import type { HeaderTemplate } from '../../src/service/storefront/header/types'
import type { FooterTemplate } from '../../src/service/storefront/footer/types'

// ── 小工具 ──────────────────────────────────────────────────────────────

/** 兩個裝置同值。種子資料多數欄位不需要分裝置,用這個少寫一半。 */
export const both = <T>(v: T): PerDevice<T> => ({ desktop: v, mobile: v })

/** 種子資料省略 visibility,由這裡補 'all'(含巢狀 children)。 */
type SeedBlock = Omit<BlockInstance, 'visibility' | 'children'> & {
  visibility?: DeviceVisibility
  children?: SeedBlock[]
}

function normalize(b: SeedBlock): BlockInstance {
  return {
    ...b,
    visibility: b.visibility ?? 'all',
    children: b.children?.map(normalize),
  }
}

const tree = (blocks: SeedBlock[]): BlockInstance[] => blocks.map(normalize)

function now(): string {
  return new Date().toISOString()
}

let seq = 0
export function nextId(prefix: string): string {
  seq += 1
  return `${prefix}-${seq}`
}

// ── 內容(區塊樹) ───────────────────────────────────────────────────────

// 首頁 hero = 疊層 → 圖片(填滿,底層)+ 內容容器(貼齊置中,上層)。自然順序疊,不管 z-index。
const homeContent = tree([
  {
    id: 'hero',
    type: 'stack',
    data: { minHeight: 400, padding: 0 },
    children: [
      {
        id: 'hero-img',
        type: 'image',
        data: {
          src: 'https://picsum.photos/seed/hero/1200/440',
          fit: 'cover',
          overlay: 35,
          action: { kind: 'none' },
        },
        size: both({ w: 'fill', h: 'fill' }),
        pos: both('center'),
      },
      {
        id: 'hero-c',
        type: 'container',
        data: {
          // 分裝置:電腦水平留白大,手機收窄。方向兩邊都是 column。
          direction: both('column'),
          justify: both('center'),
          align: both('center'),
          gap: { desktop: 14, mobile: 10 },
          padding: { desktop: 24, mobile: 16 },
        },
        size: both({ w: 'hug', h: 'hug' }),
        pos: both('center'),
        children: [
          {
            id: 'hero-h',
            type: 'heading',
            data: { text: '夏季新品上市', level: 'h1', align: both('center'), color: '#ffffff' },
          },
          {
            id: 'hero-s',
            type: 'text',
            data: {
              text: '全館精選 5 折起,把握檔期',
              align: both('center'),
              color: '#ffffff',
            },
          },
          {
            id: 'hero-b',
            type: 'button',
            data: {
              text: '立即選購',
              action: { kind: 'begin_checkout' },
              variant: 'primary',
              align: both('center'),
            },
          },
        ],
      },
    ],
  },
  {
    id: 'b2',
    type: 'text',
    data: { text: '歡迎光臨,精選好物等你發現。', align: both('center') },
  },
])

// 頁首 = 容器(水平、兩端對齊):左 Logo、中 選單、右 動作。
// 這份種子順便示範**顯示裝置** —— 橫向選單只在電腦、漢堡只在手機。
const headerContent = tree([
  {
    id: 'hdr',
    type: 'container',
    data: {
      direction: both('row'),
      justify: both('space-between'),
      align: both('center'),
      gap: { desktop: 24, mobile: 8 },
      padding: { desktop: 16, mobile: 12 },
      background: '#ffffff',
    },
    children: [
      {
        id: 'hdr-burger',
        type: 'icon',
        data: { name: 'menu', size: 22, color: '#333333', action: { kind: 'none' } },
        visibility: 'mobile',
      },
      { id: 'logo', type: 'heading', data: { text: '我的商店', level: 'h3', align: both('left') } },
      {
        id: 'menu',
        type: 'container',
        data: {
          direction: both('row'),
          justify: both('center'),
          align: both('center'),
          gap: both(24),
          padding: both(0),
        },
        visibility: 'desktop',
        children: [
          { id: 'm1', type: 'text', data: { text: '新品', align: both('center') } },
          { id: 'm2', type: 'text', data: { text: '女裝', align: both('center') } },
          { id: 'm3', type: 'text', data: { text: '男裝', align: both('center') } },
          { id: 'm4', type: 'text', data: { text: '配件', align: both('center') } },
        ],
      },
      {
        id: 'acts',
        type: 'container',
        data: {
          direction: both('row'),
          justify: both('flex-end'),
          align: both('center'),
          gap: both(6),
          padding: both(0),
        },
        children: [
          {
            id: 'a-search',
            type: 'icon',
            data: {
              name: 'search',
              // 手機的點擊目標要大一點。
              size: { desktop: 22, mobile: 26 },
              color: '#333333',
              action: { kind: 'none' },
            },
          },
          {
            id: 'a-user',
            type: 'icon',
            data: { name: 'user', size: both(22), color: '#333333', action: { kind: 'login' } },
            visibility: 'desktop',
          },
          {
            id: 'a-cart',
            type: 'icon',
            data: {
              name: 'cart',
              size: { desktop: 22, mobile: 26 },
              color: '#333333',
              badge: '2',
              action: { kind: 'view_cart' },
            },
          },
        ],
      },
    ],
  },
])

// 頁尾 = 容器(垂直、置中):連結列 + 版權。
const footerContent = tree([
  {
    id: 'ftr',
    type: 'container',
    data: {
      direction: both('column'),
      justify: both('center'),
      align: both('center'),
      gap: both(12),
      padding: { desktop: 28, mobile: 20 },
      background: '#f7f7f7',
    },
    children: [
      {
        id: 'fl',
        type: 'container',
        data: {
          // 連結列:電腦一排,手機換行擠在一起。
          direction: both('row'),
          justify: both('center'),
          align: both('center'),
          wrap: both(true),
          gap: { desktop: 20, mobile: 10 },
          padding: both(0),
        },
        children: [
          { id: 'fl1', type: 'text', data: { text: '關於我們' } },
          { id: 'fl2', type: 'text', data: { text: '隱私權' } },
          { id: 'fl3', type: 'text', data: { text: '運送說明' } },
          { id: 'fl4', type: 'text', data: { text: '客服中心' } },
        ],
      },
      {
        id: 'cr',
        type: 'text',
        data: { text: '© 2026 我的商店　All rights reserved.', align: both('center') },
      },
    ],
  },
])

// ── 資料 ────────────────────────────────────────────────────────────────
// 存完整資料(含 content);list 端點自己投影掉 content。

export interface HomePageRow extends HomePageTemplate {
  content: BlockInstance[]
}
export interface HeaderRow extends HeaderTemplate {
  content: BlockInstance[]
}
export interface FooterRow extends FooterTemplate {
  content: BlockInstance[]
}

export const db = {
  homePages: [
    {
      id: 't-home-1',
      name: '預設首頁',
      status: 'active',
      isFallback: true,
      version: 3,
      updatedAt: '2026-07-20T14:05:00Z',
      note: '常態版(永久兜底)',
      content: homeContent,
    },
    {
      id: 't-home-2',
      name: '周年慶首頁',
      status: 'active',
      isFallback: false,
      targeting: {
        schedule: { start: '2026-08-01T00:00:00+08:00', end: '2026-08-14T23:59:59+08:00' },
        priority: 100,
      },
      version: 1,
      updatedAt: '2026-07-24T09:30:00Z',
      note: '檔期 8/1–8/14',
      content: [],
    },
    {
      id: 't-home-3',
      name: '實驗版 A',
      status: 'draft',
      isFallback: false,
      version: 2,
      updatedAt: '2026-07-25T18:12:00Z',
      note: '首屏改大 banner',
      content: [],
    },
  ] as HomePageRow[],

  headers: [
    {
      id: 't-hdr-1',
      name: '預設頁首',
      status: 'active',
      isSiteDefault: true,
      version: 1,
      updatedAt: '2026-07-20T14:05:00Z',
      note: '站台預設',
      content: headerContent,
    },
    {
      id: 't-hdr-2',
      name: '促銷頁首',
      status: 'active',
      isSiteDefault: false,
      version: 1,
      updatedAt: '2026-07-28T10:00:00Z',
      note: '另一版頁首,可設為站台預設',
      content: [],
    },
  ] as HeaderRow[],

  footers: [
    {
      id: 't-ftr-1',
      name: '預設頁尾',
      status: 'active',
      isSiteDefault: true,
      version: 1,
      updatedAt: '2026-07-20T14:05:00Z',
      note: '站台預設',
      content: footerContent,
    },
  ] as FooterRow[],

  audits: [] as (AuditEntry & { kind: 'home-page' | 'header' | 'footer' })[],
}

export function logAudit(
  kind: 'home-page' | 'header' | 'footer',
  templateId: string,
  action: AuditAction,
  detail?: string,
): void {
  db.audits.unshift({ kind, id: nextId('a'), templateId, action, detail, at: now() })
}

export function auditOf(templateId: string): AuditEntry[] {
  return db.audits
    .filter((a) => a.templateId === templateId)
    .map(({ kind: _kind, ...rest }) => rest)
}

// ── 回應 ────────────────────────────────────────────────────────────────
// 狀態碼要依條件變(404 / 409 / 400),所以不能用 defineMock 的靜態 `status`,
// 一律走 `response` 自己寫。錯誤體形狀對齊後端的 { error: string }。

/** 送 JSON 並結束回應。 */
export function json(res: MockResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export const notFound = (res: MockResponse) => json(res, 404, { error: '找不到模板' })
export const conflict = (res: MockResponse, msg: string) => json(res, 409, { error: msg })
export const badRequest = (res: MockResponse, msg: string) => json(res, 400, { error: msg })

/** 名稱驗證,與後端 `clean_name` 同規則。 */
export function cleanName(name: unknown): string | null {
  const s = typeof name === 'string' ? name.trim() : ''
  return s === '' ? null : s
}

/** 列表投影:拿掉 content(對齊後端的精簡投影)。 */
export function toSummary<T extends { content: BlockInstance[] }>(row: T): Omit<T, 'content'> {
  const { content: _content, ...rest } = row
  return rest
}

export { now }
