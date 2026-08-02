import { format } from 'date-fns'
import type {
  AuditAction,
  AuditEntry,
  BlockInstance,
  ChromeOverride,
  SlotKind,
  Targeting,
  PageTemplate,
  PageTemplateEntity,
} from './types'
import { resolveChrome } from './resolve'

// 記憶體 / localStorage mock,對齊未來編輯 API 的合約。真後端接上後只換這層。
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms))
const now = () => format(new Date(), 'yyyy-MM-dd HH:mm')

const ls = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = globalThis.localStorage?.getItem(key)
      return v ? (JSON.parse(v) as T) : fallback
    } catch {
      return fallback
    }
  },
  set(key: string, val: unknown): void {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(val))
    } catch {
      /* 忽略 */
    }
  },
}

// ── 版位模板(metadata + 定向;不含 content)──────────────
let templates: PageTemplate[] = [
  {
    id: 't-home-1',
    slot: 'home',
    name: '預設首頁',
    status: 'active',
    isDefault: true,
    version: 3,
    updatedAt: '2026-07-20 14:05',
    note: '常態版(永久兜底)',
  },
  {
    id: 't-home-2',
    slot: 'home',
    name: '周年慶首頁',
    status: 'active',
    targeting: {
      schedule: { start: '2026-08-01T00:00:00+08:00', end: '2026-08-14T23:59:59+08:00' },
      priority: 100,
    },
    version: 1,
    updatedAt: '2026-07-24 09:30',
    note: '檔期 8/1–8/14',
  },
  {
    id: 't-home-3',
    slot: 'home',
    name: '實驗版 A',
    status: 'draft',
    version: 2,
    updatedAt: '2026-07-25 18:12',
    note: '首屏改大 banner',
  },
  {
    id: 't-hdr-1',
    slot: 'header',
    name: '預設頁首',
    status: 'active',
    isDefault: true,
    version: 1,
    updatedAt: '2026-07-20 14:05',
    note: '常態版',
  },
  {
    id: 't-hdr-2',
    slot: 'header',
    name: '促銷頁首',
    status: 'active',
    version: 1,
    updatedAt: '2026-07-28 10:00',
    note: '另一版外框,可設為站台預設',
  },
  {
    id: 't-ftr-1',
    slot: 'footer',
    name: '預設頁尾',
    status: 'active',
    isDefault: true,
    version: 1,
    updatedAt: '2026-07-20 14:05',
    note: '常態版',
  },
]

// 異動紀錄(記憶體)。
let audit: AuditEntry[] = []
let auditSeq = 0
function logAudit(templateId: string, action: AuditAction, detail?: string) {
  auditSeq += 1
  audit = [{ id: `a-${auditSeq}`, templateId, action, detail, at: now() }, ...audit]
}

const CONTENT_KEY = (id: string) => `sf:draft2:${id}`

let seq = 0

// 列表 API:精簡投影(含 status / targeting / isDefault,不含 content)。
export async function listTemplates(slot: SlotKind): Promise<PageTemplate[]> {
  await delay()
  return templates.filter((v) => v.slot === slot).map((v) => ({ ...v }))
}

// 實體 API:一次回完整 entity(投影欄位 + targeting + content)。
export async function getTemplate(id: string): Promise<PageTemplateEntity | undefined> {
  await delay()
  const v = templates.find((x) => x.id === id)
  if (!v) return undefined
  return { ...v, content: ls.get(CONTENT_KEY(id), seedContent[id] ?? []) }
}

// 新增草稿(status = draft)。
export async function createDraft(slot: SlotKind, name: string): Promise<PageTemplate> {
  await delay()
  seq += 1
  const v: PageTemplate = {
    id: `t-${slot}-new-${seq}`,
    slot,
    name,
    status: 'draft',
    version: 1,
    updatedAt: now(),
  }
  templates = [v, ...templates]
  logAudit(v.id, 'create', name)
  return { ...v }
}

// 存草稿(content / targeting / name)——僅草稿可改(不可變性)。
export async function saveDraft(
  id: string,
  patch: {
    content?: BlockInstance[]
    targeting?: Targeting
    chrome?: ChromeOverride
    name?: string
  },
): Promise<void> {
  await delay()
  const v = templates.find((x) => x.id === id)
  if (!v || v.status !== 'draft') return
  if (patch.content) ls.set(CONTENT_KEY(id), patch.content)
  templates = templates.map((x) =>
    x.id === id
      ? {
          ...x,
          targeting: patch.targeting ?? x.targeting,
          chrome: patch.chrome ?? x.chrome,
          name: patch.name ?? x.name,
          updatedAt: now(),
        }
      : x,
  )
  logAudit(id, 'save-draft')
}

// 頁首/頁尾:設為站台預設(同版位只有一個;僅 active 可設)。
export async function setSiteDefault(id: string): Promise<void> {
  await delay()
  const target = templates.find((v) => v.id === id)
  if (!target || target.status !== 'active') return
  templates = templates.map((v) =>
    v.slot !== target.slot
      ? v
      : { ...v, isDefault: v.id === id, updatedAt: v.id === id ? now() : v.updatedAt },
  )
  logAudit(id, 'set-default')
}

// 發布:草稿 → active,凍結。
export async function publish(
  id: string,
  patch: { content?: BlockInstance[]; targeting?: Targeting },
): Promise<void> {
  await delay()
  const v = templates.find((x) => x.id === id)
  if (!v || v.status !== 'draft') return
  if (patch.content) ls.set(CONTENT_KEY(id), patch.content)
  templates = templates.map((x) =>
    x.id === id
      ? { ...x, status: 'active', targeting: patch.targeting ?? x.targeting, updatedAt: now() }
      : x,
  )
  logAudit(id, 'publish')
}

// 已發布唯一可改欄位:優先序。
export async function updatePriority(id: string, priority: number): Promise<void> {
  await delay()
  templates = templates.map((x) =>
    x.id === id ? { ...x, targeting: { ...x.targeting, priority }, updatedAt: now() } : x,
  )
  logAudit(id, 'priority', String(priority))
}

// 暫停:常態版 / 站台預設(isDefault)是永久兜底,不可暫停 —— 否則該版位可能沒 active 可解。
export async function pauseTemplate(id: string): Promise<void> {
  await delay()
  const t = templates.find((x) => x.id === id)
  if (!t || t.status !== 'active' || t.isDefault) return
  templates = templates.map((x) => (x.id === id ? { ...x, status: 'paused', updatedAt: now() } : x))
  logAudit(id, 'pause')
}

export async function resumeTemplate(id: string): Promise<void> {
  await delay()
  templates = templates.map((x) =>
    x.id === id && x.status === 'paused' ? { ...x, status: 'active', updatedAt: now() } : x,
  )
  logAudit(id, 'resume')
}

// 刪除(常態版不可刪)。
export async function deleteTemplate(id: string): Promise<void> {
  await delay()
  const v = templates.find((x) => x.id === id)
  if (!v || v.isDefault) return
  templates = templates.filter((x) => x.id !== id)
}

// ── 內容(區塊樹)── localStorage,鍵為模板 id ──────────
const seedContent: Record<string, BlockInstance[]> = {
  // 首頁 hero = 疊層 → 圖片(填滿·自帶遮罩,底層)+ 內容(貼齊·置中,上層)。自然順序疊,不管 z-index。
  't-home-1': [
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
          size: { w: 'fill', h: 'fill' },
          pos: 'center',
        },
        {
          id: 'hero-c',
          type: 'container',
          data: { direction: 'column', justify: 'center', align: 'center', gap: 14, padding: 24 },
          size: { w: 'hug', h: 'hug' },
          pos: 'center',
          children: [
            {
              id: 'hero-h',
              type: 'heading',
              data: { text: '夏季新品上市', level: 'h1', align: 'center', color: '#ffffff' },
            },
            {
              id: 'hero-s',
              type: 'text',
              data: { text: '全館精選 5 折起,把握檔期', align: 'center', color: '#ffffff' },
            },
            {
              id: 'hero-b',
              type: 'button',
              data: {
                text: '立即選購',
                action: { kind: 'begin_checkout' },
                variant: 'primary',
                align: 'center',
              },
            },
          ],
        },
      ],
    },
    { id: 'b2', type: 'text', data: { text: '歡迎光臨,精選好物等你發現。', align: 'center' } },
  ],
  // 頁首 = 版面 Flex(水平、兩端對齊)組出來:左 Logo、中 選單、右 動作。可自由重排。
  't-hdr-1': [
    {
      id: 'hdr',
      type: 'container',
      data: {
        direction: 'row',
        justify: 'space-between',
        align: 'center',
        gap: 24,
        padding: 16,
        background: '#ffffff',
      },
      children: [
        { id: 'logo', type: 'heading', data: { text: '我的商店', level: 'h3', align: 'left' } },
        {
          id: 'menu',
          type: 'container',
          data: { direction: 'row', justify: 'center', align: 'center', gap: 24, padding: 0 },
          children: [
            { id: 'm1', type: 'text', data: { text: '新品', align: 'center' } },
            { id: 'm2', type: 'text', data: { text: '女裝', align: 'center' } },
            { id: 'm3', type: 'text', data: { text: '男裝', align: 'center' } },
            { id: 'm4', type: 'text', data: { text: '配件', align: 'center' } },
          ],
        },
        {
          id: 'acts',
          type: 'container',
          data: { direction: 'row', justify: 'flex-end', align: 'center', gap: 6, padding: 0 },
          children: [
            {
              id: 'a-search',
              type: 'icon',
              data: { name: 'search', size: 22, color: '#333333', action: { kind: 'none' } },
            },
            {
              id: 'a-user',
              type: 'icon',
              data: { name: 'user', size: 22, color: '#333333', action: { kind: 'login' } },
            },
            {
              id: 'a-cart',
              type: 'icon',
              data: {
                name: 'cart',
                size: 22,
                color: '#333333',
                badge: '2',
                action: { kind: 'view_cart' },
              },
            },
          ],
        },
      ],
    },
  ],
  // 頁尾 = 版面 Flex(垂直、置中)組出來:連結列 + 版權。
  't-ftr-1': [
    {
      id: 'ftr',
      type: 'container',
      data: {
        direction: 'column',
        justify: 'center',
        align: 'center',
        gap: 12,
        padding: 28,
        background: '#f7f7f7',
      },
      children: [
        {
          id: 'fl',
          type: 'container',
          data: { direction: 'row', justify: 'center', align: 'center', gap: 20, padding: 0 },
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
          data: { text: '© 2026 我的商店　All rights reserved.', align: 'center' },
        },
      ],
    },
  ],
}

// 前台預覽:讀某模板的 content(by id)。
export async function getTemplateDraft(id: string): Promise<BlockInstance[]> {
  await delay()
  return ls.get(CONTENT_KEY(id), seedContent[id] ?? [])
}

// 首頁編輯 / 前台預覽的上下文:用 resolve 選出該版位當下生效的模板(訪客視角 guest),回其 content。
// 站台預設外框:頁首/頁尾用 resolveChrome(取站台預設),不跑完整生效。
export async function getActiveLayoutContent(slot: 'header' | 'footer'): Promise<BlockInstance[]> {
  await delay()
  const winner = resolveChrome(templates.filter((v) => v.slot === slot))
  if (!winner) return []
  return ls.get(CONTENT_KEY(winner.id), seedContent[winner.id] ?? [])
}

// 異動紀錄查詢(某模板)。
export async function getAudit(templateId: string): Promise<AuditEntry[]> {
  await delay()
  return audit.filter((a) => a.templateId === templateId).map((a) => ({ ...a }))
}
