import type { HomePageTemplate, Targeting, UtmRule } from './types'

// 解析:同一站多份首頁模板,依「現在時間 + 訪客是誰 + 從哪來」算出當下該呈現哪一份。
// 純函式 —— 同輸入必得同一份 → 可快取。
//
// 這裡只有首頁模板的解析。頁首 / 頁尾不跑這套(它們只有站台預設),
// 後端直接提供 `/headers/site-default-content` 端點,前端不必自己算。

// 解析輸入:v1 後台預覽只用 now + loggedIn(訪客視角)。
// utm 是這次到訪帶的實際 UTM 參數(五欄),拿來跟模板設的 UtmRule 比對。
export interface ResolveCtx {
  now: Date
  loggedIn?: boolean
  utm?: UtmRule
  geo?: string
}

function inSchedule(s: Targeting['schedule'], now: Date): boolean {
  if (!s) return true
  if (s.start && now < new Date(s.start)) return false
  if (s.end && now > new Date(s.end)) return false
  return true
}

function inAudience(a: Targeting['audience'], ctx: ResolveCtx): boolean {
  if (!a?.login) return true
  return a.login === 'required' ? !!ctx.loggedIn : !ctx.loggedIn
}

function inList(allowed: string[] | undefined, val: string | undefined): boolean {
  if (!allowed || allowed.length === 0) return true
  return val != null && allowed.includes(val)
}

const UTM_KEYS: (keyof UtmRule)[] = ['source', 'medium', 'campaign', 'term', 'content']

// 一組 UTM 是否命中:組內每個「有設的」參數都要相等(AND);全空的組 = 不限 → 命中。
function utmRuleHit(rule: UtmRule, v: UtmRule | undefined): boolean {
  return UTM_KEYS.every((k) => !rule[k] || v?.[k] === rule[k])
}

// 多組 UTM:沒設 = 不限;有設 = 命中任一組即算符合(OR)。
function inUtm(rules: UtmRule[] | undefined, v: UtmRule | undefined): boolean {
  if (!rules || rules.length === 0) return true
  return rules.some((r) => utmRuleHit(r, v))
}

// 這組 UTM 條件是否有實質內容(至少一組、至少一欄有設)。空組不算數。
export function hasUtm(rules?: UtmRule[]): boolean {
  return !!rules?.some((r) => UTM_KEYS.some((k) => r[k]))
}

function inSource(s: Targeting['source'], ctx: ResolveCtx): boolean {
  if (!s) return true
  return inUtm(s.utm, ctx.utm) && inList(s.geo, ctx.geo)
}

// 定向的「具體度」:設了幾個維度。平手時具體者勝過常態。
function specificity(t?: Targeting): number {
  let n = 0
  if (t?.schedule) n += 1
  if (t?.audience?.login) n += 1
  if (t?.source && (hasUtm(t.source.utm) || t.source.geo?.length)) n += 1
  return n
}

/**
 * FILTER(status ∧ 時間 ∧ 受眾 ∧ 來源)→ SORT(priority → specificity → 常態墊底)。
 *
 * 常態版(isFallback、無條件、priority 最低)永遠合格且排最後 → 兜底免特判,
 * 所以這個函式在有資料時**永遠有解**。
 */
export function resolveHomePage(
  templates: HomePageTemplate[],
  ctx: ResolveCtx,
): HomePageTemplate | undefined {
  const candidates = templates.filter(
    (t) =>
      t.status === 'active' &&
      inSchedule(t.targeting?.schedule, ctx.now) &&
      inAudience(t.targeting?.audience, ctx) &&
      inSource(t.targeting?.source, ctx),
  )
  return candidates.slice().sort((a, b) => {
    const pa = a.targeting?.priority ?? 0
    const pb = b.targeting?.priority ?? 0
    if (pb !== pa) return pb - pa
    const sa = specificity(a.targeting)
    const sb = specificity(b.targeting)
    if (sb !== sa) return sb - sa
    return (a.isFallback ? 1 : 0) - (b.isFallback ? 1 : 0)
  })[0]
}
