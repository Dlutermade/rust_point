import type { MockOptions } from 'vite-plugin-mock-dev-server'
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
import type { FooterRow, HeaderRow } from './_store'

// 頁首 / 頁尾的端點形狀目前完全相同,用工廠產生兩份,避免同樣的 150 行抄兩次。
//
// 這是 **mock 實作層**的共用,不是把兩者當成同一類東西 —— 領域上它們沒有共同上位型別
// (見 docs business/03),各自的 service 模組與後端資料表都是分開的。
// 哪天頁尾長出頁首沒有的東西,這個工廠就該拆掉,而不是加參數。

type ChromeRow = HeaderRow | FooterRow

interface EndpointOptions {
  /** 路由前綴,如 `/api/headers`。 */
  base: string
  /** audit 分類。 */
  kind: 'header' | 'footer'
  /** 這組端點操作 db 的哪個陣列。 */
  key: 'headers' | 'footers'
  /** 新 id 前綴。 */
  idPrefix: string
}

const DELAY: [number, number] = [120, 320]

export function makeTemplateEndpoints({ base, kind, key, idPrefix }: EndpointOptions): MockOptions {
  const rows = () => db[key] as ChromeRow[]
  const find = (id: string) => rows().find((t) => t.id === id)

  function applyPatch(row: ChromeRow, patch: Record<string, unknown>): string | null {
    if ('name' in patch) {
      const name = cleanName(patch.name)
      if (!name) return '名稱不可為空'
      row.name = name
    }
    if ('content' in patch) row.content = patch.content as ChromeRow['content']
    return null
  }

  return [
    {
      url: `${base}/site-default-content`,
      method: 'GET',
      delay: DELAY,
      response(_req, res) {
        // 取站台預設的 active,沒有就取第一個 active,都沒有回空陣列(對齊後端)。
        const actives = rows().filter((t) => t.status === 'active')
        const winner = actives.find((t) => t.isSiteDefault) ?? actives[0]
        json(res, 200, winner?.content ?? [])
      },
    },
    {
      url: base,
      method: 'GET',
      delay: DELAY,
      response(_req, res) {
        const sorted = [...rows()].sort(
          (a, b) =>
            Number(a.isSiteDefault) - Number(b.isSiteDefault) ||
            b.updatedAt.localeCompare(a.updatedAt),
        )
        json(res, 200, sorted.map(toSummary))
      },
    },
    {
      url: base,
      method: 'POST',
      delay: DELAY,
      response(req, res) {
        const patch = (req.body ?? {}) as Record<string, unknown>
        const name = cleanName(patch.name)
        if (!name) return badRequest(res, '名稱不可為空')
        const row = {
          id: nextId(idPrefix),
          name,
          status: 'draft',
          isSiteDefault: false,
          version: 0,
          updatedAt: now(),
          content: [],
        } as ChromeRow
        applyPatch(row, { ...patch, name })
        rows().unshift(row)
        const copyFrom = patch.copyFrom as string | undefined
        logAudit(kind, row.id, copyFrom ? 'duplicate' : 'create', copyFrom && `複製自 ${copyFrom}`)
        json(res, 201, toSummary(row))
      },
    },
    {
      url: `${base}/:id`,
      method: 'GET',
      delay: DELAY,
      response(req, res) {
        const row = find(req.params.id)
        return row ? json(res, 200, row) : notFound(res)
      },
    },
    {
      url: `${base}/:id`,
      method: 'DELETE',
      delay: DELAY,
      response(req, res) {
        const row = find(req.params.id)
        if (!row) return notFound(res)
        if (row.isSiteDefault) return conflict(res, '站台預設不可刪除')
        if (row.status === 'active') return conflict(res, '已發布的模板不可刪除,請先暫停')
        // 被首頁模板指定為外框的,連帶清成「跟隨站台預設」(對齊後端)。
        const ref = kind === 'header' ? 'headerTemplateId' : 'footerTemplateId'
        for (const page of db.homePages) {
          if (page[ref] === row.id) page[ref] = undefined
        }
        db[key] = rows().filter((t) => t.id !== row.id) as never
        json(res, 204, null)
      },
    },
    {
      url: `${base}/:id/draft`,
      method: 'PATCH',
      delay: DELAY,
      response(req, res) {
        const row = find(req.params.id)
        if (!row) return notFound(res)
        if (row.status !== 'draft') return conflict(res, '已發布的模板不可修改,請複製一份再編輯')
        const err = applyPatch(row, (req.body ?? {}) as Record<string, unknown>)
        if (err) return badRequest(res, err)
        row.updatedAt = now()
        logAudit(kind, row.id, 'save-draft')
        json(res, 200, toSummary(row))
      },
    },
    {
      url: `${base}/:id/publish`,
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
        logAudit(kind, row.id, 'publish')
        json(res, 200, toSummary(row))
      },
    },
    {
      url: `${base}/:id/site-default`,
      method: 'POST',
      delay: DELAY,
      response(req, res) {
        const row = find(req.params.id)
        if (!row) return notFound(res)
        if (row.status !== 'active') return conflict(res, '只有已發布的模板能設站台預設')
        for (const t of rows()) t.isSiteDefault = t.id === row.id
        row.updatedAt = now()
        logAudit(kind, row.id, 'set-site-default')
        json(res, 200, toSummary(row))
      },
    },
    {
      url: `${base}/:id/pause`,
      method: 'POST',
      delay: DELAY,
      response(req, res) {
        const row = find(req.params.id)
        if (!row) return notFound(res)
        if (row.isSiteDefault) return conflict(res, '站台預設不可暫停')
        if (row.status !== 'active') return conflict(res, '只有已發布的模板可以暫停')
        row.status = 'paused'
        row.updatedAt = now()
        logAudit(kind, row.id, 'pause')
        json(res, 200, toSummary(row))
      },
    },
    {
      url: `${base}/:id/resume`,
      method: 'POST',
      delay: DELAY,
      response(req, res) {
        const row = find(req.params.id)
        if (!row) return notFound(res)
        if (row.status !== 'paused') return conflict(res, '只有暫停中的模板可以恢復')
        row.status = 'active'
        row.updatedAt = now()
        logAudit(kind, row.id, 'resume')
        json(res, 200, toSummary(row))
      },
    },
    {
      url: `${base}/:id/audit`,
      method: 'GET',
      delay: DELAY,
      response(req, res) {
        const row = find(req.params.id)
        return row ? json(res, 200, auditOf(row.id)) : notFound(res)
      },
    },
    {
      url: `${base}/:id/content`,
      method: 'GET',
      delay: DELAY,
      response(req, res) {
        const row = find(req.params.id)
        return row ? json(res, 200, row.content) : notFound(res)
      },
    },
  ]
}
