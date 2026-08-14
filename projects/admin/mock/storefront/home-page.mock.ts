import { defineMock } from 'vite-plugin-mock-dev-server'
import {
  auditOf,
  badRequest,
  cleanName,
  conflict,
  db,
  json,
  logAudit,
  nextId,
  notFound,
  now,
  toSummary,
} from './_store'
import type { HomePageRow } from './_store'

// 首頁模板端點。狀態機規則對齊 storefront-center/src/store/memory.rs —— mock 比真後端
// 寬鬆的話,前端就會寫出上線才爆的程式碼。

const DELAY: [number, number] = [120, 320]

const find = (id: string): HomePageRow | undefined => db.homePages.find((t) => t.id === id)

/** 套用 patch。可清空的欄位吃 null:給 null = 清空,欄位不出現 = 不動。 */
function applyPatch(row: HomePageRow, patch: Record<string, unknown>): string | null {
  if ('name' in patch) {
    const name = cleanName(patch.name)
    if (!name) return '名稱不可為空'
    row.name = name
  }
  if ('seoTitle' in patch) row.seoTitle = (patch.seoTitle as string | null) ?? undefined
  if ('seoDescription' in patch) {
    row.seoDescription = (patch.seoDescription as string | null) ?? undefined
  }
  if ('targeting' in patch) row.targeting = patch.targeting as HomePageRow['targeting']
  if ('headerTemplateId' in patch) {
    row.headerTemplateId = (patch.headerTemplateId as string | null) ?? undefined
  }
  if ('footerTemplateId' in patch) {
    row.footerTemplateId = (patch.footerTemplateId as string | null) ?? undefined
  }
  if ('content' in patch) row.content = patch.content as HomePageRow['content']
  return null
}

export default defineMock([
  {
    url: '/api/home-pages',
    method: 'GET',
    delay: DELAY,
    response(_req, res) {
      // 常態版排最後、其餘依更新時間新到舊(對齊後端的列表順序)。
      const rows = [...db.homePages].sort(
        (a, b) =>
          Number(a.isFallback) - Number(b.isFallback) || b.updatedAt.localeCompare(a.updatedAt),
      )
      json(res, 200, rows.map(toSummary))
    },
  },
  {
    url: '/api/home-pages',
    method: 'POST',
    delay: DELAY,
    response(req, res) {
      const patch = (req.body ?? {}) as Record<string, unknown>
      const name = cleanName(patch.name)
      if (!name) return badRequest(res, '名稱不可為空')
      const row: HomePageRow = {
        id: nextId('t-home-new'),
        name,
        status: 'draft',
        isFallback: false,
        version: 0,
        updatedAt: now(),
        content: [],
      }
      // 建立時就能帶完整內容 —— 不必再補一趟 save-draft。
      applyPatch(row, { ...patch, name })
      db.homePages.unshift(row)
      // 從既有模板複製而來時記成 duplicate,保住「這份是從哪來的」這條線索。
      const copyFrom = patch.copyFrom as string | undefined
      logAudit('home-page', row.id, copyFrom ? 'duplicate' : 'create', copyFrom && `複製自 ${copyFrom}`)
      json(res, 201, toSummary(row))
    },
  },
  {
    url: '/api/home-pages/:id',
    method: 'GET',
    delay: DELAY,
    response(req, res) {
      const row = find(req.params.id)
      return row ? json(res, 200, row) : notFound(res)
    },
  },
  {
    url: '/api/home-pages/:id',
    method: 'DELETE',
    delay: DELAY,
    response(req, res) {
      const row = find(req.params.id)
      if (!row) return notFound(res)
      if (row.isFallback) return conflict(res, '常態版不可刪除')
      if (row.status === 'active') return conflict(res, '已發布的模板不可刪除,請先暫停')
      db.homePages = db.homePages.filter((t) => t.id !== row.id)
      json(res, 204, null)
    },
  },
  {
    url: '/api/home-pages/:id/draft',
    method: 'PATCH',
    delay: DELAY,
    response(req, res) {
      const row = find(req.params.id)
      if (!row) return notFound(res)
      if (row.status !== 'draft') return conflict(res, '已發布的模板不可修改,請複製一份再編輯')
      const err = applyPatch(row, (req.body ?? {}) as Record<string, unknown>)
      if (err) return badRequest(res, err)
      row.updatedAt = now()
      logAudit('home-page', row.id, 'save-draft')
      json(res, 200, toSummary(row))
    },
  },
  {
    url: '/api/home-pages/:id/publish',
    method: 'POST',
    delay: DELAY,
    response(req, res) {
      const row = find(req.params.id)
      if (!row) return notFound(res)
      if (row.status !== 'draft') return conflict(res, '只有草稿可以發布')
      const err = applyPatch(row, (req.body ?? {}) as Record<string, unknown>)
      if (err) return badRequest(res, err)
      row.status = 'active'
      row.version += 1
      row.updatedAt = now()
      logAudit('home-page', row.id, 'publish')
      json(res, 200, toSummary(row))
    },
  },
  {
    url: '/api/home-pages/:id/priority',
    method: 'PUT',
    delay: DELAY,
    response(req, res) {
      const row = find(req.params.id)
      if (!row) return notFound(res)
      const priority = Number((req.body as { priority?: number })?.priority ?? 0)
      row.targeting = { ...row.targeting, priority }
      row.updatedAt = now()
      logAudit('home-page', row.id, 'priority', String(priority))
      json(res, 200, toSummary(row))
    },
  },
  {
    url: '/api/home-pages/:id/pause',
    method: 'POST',
    delay: DELAY,
    response(req, res) {
      const row = find(req.params.id)
      if (!row) return notFound(res)
      if (row.isFallback) return conflict(res, '常態版不可暫停')
      if (row.status !== 'active') return conflict(res, '只有已發布的模板可以暫停')
      row.status = 'paused'
      row.updatedAt = now()
      logAudit('home-page', row.id, 'pause')
      json(res, 200, toSummary(row))
    },
  },
  {
    url: '/api/home-pages/:id/resume',
    method: 'POST',
    delay: DELAY,
    response(req, res) {
      const row = find(req.params.id)
      if (!row) return notFound(res)
      if (row.status !== 'paused') return conflict(res, '只有暫停中的模板可以恢復')
      row.status = 'active'
      row.updatedAt = now()
      logAudit('home-page', row.id, 'resume')
      json(res, 200, toSummary(row))
    },
  },
  {
    url: '/api/home-pages/:id/audit',
    method: 'GET',
    delay: DELAY,
    response(req, res) {
      const row = find(req.params.id)
      return row ? json(res, 200, auditOf(row.id)) : notFound(res)
    },
  },
  {
    url: '/api/home-pages/:id/content',
    method: 'GET',
    delay: DELAY,
    response(req, res) {
      const row = find(req.params.id)
      return row ? json(res, 200, row.content) : notFound(res)
    },
  },
])
