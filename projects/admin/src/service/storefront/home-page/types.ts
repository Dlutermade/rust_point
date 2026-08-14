import type { BlockInstance, TemplateStatus } from '../shared/types'

// ── 生效條件(首頁模板專屬) ────────────────────────────────────────────
// 頁首 / 頁尾不吃這個 —— 它們只有「哪一份是站台預設」。

// 一組 UTM 條件:五個標準參數,設了的欄位才比對(組內 AND;留空 = 不限該參數)。
// 一個 source.utm 可有多組,組間為 OR(命中任一組即算來源符合)。
export interface UtmRule {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
}

// 生效 / 定向規則(全 optional;沒設的維度 = 永遠命中)。見 docs business/09 + technical/10。
export interface Targeting {
  schedule?: { start?: string; end?: string }
  audience?: { login?: 'required' | 'guest' } // 省略 = 不判斷
  source?: { utm?: UtmRule[]; geo?: string[] }
  priority?: number
}

// ── 模板 ──────────────────────────────────────────────────────────────

/**
 * 首頁模板。同一站可有多份(常態版 / 周年慶版 / 會員版…),
 * 訪客上門當下依生效條件解析出一份。
 *
 * v1 沒有 slug:首頁網址恆為 `/`,而同一網址本來就對多份模板 —— slug 不是模板的屬性。
 */
export interface HomePageTemplate {
  id: string
  name: string
  status: TemplateStatus
  /** 常態版:不設條件、優先序最低、永久兜底。每站恰一份。 */
  isFallback: boolean
  seoTitle?: string
  seoDescription?: string
  targeting?: Targeting
  /** 外框覆寫:套哪份頁首 / 頁尾。**兩者可分開指定**;省略 = 跟隨站台預設。 */
  headerTemplateId?: string
  footerTemplateId?: string
  version: number
  updatedAt: string
  note?: string
}

/** 列表用精簡投影;進編輯器打實體 API 一次拿全。 */
export interface HomePageTemplateEntity extends HomePageTemplate {
  content: BlockInstance[]
}

/**
 * 可改的欄位。草稿與發布**吃同一份** —— 發布 = 套上最終欄位再轉 active,
 * 沒有理由讓它能改的比草稿少(後端 `HomePagePatch` 同形)。
 *
 * 可清空的欄位吃 `T | null`:給 `null` = 清空(取消外框覆寫,改回跟隨站台預設),
 * 欄位省略 = 不動。
 */
export interface HomePagePatch {
  name?: string
  seoTitle?: string | null
  seoDescription?: string | null
  targeting?: Targeting
  headerTemplateId?: string | null
  footerTemplateId?: string | null
  content?: BlockInstance[]
}
