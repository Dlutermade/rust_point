import type { BlockInstance, TemplateStatus } from '../shared/types'

/**
 * 頁首模板。每站可有多份,其中一份是**站台預設**(全站標準用哪一份)。
 * 不吃生效條件 —— 那是首頁模板的事;頁首要隨人變(登入 / 未登入)是元件內部的事,
 * 不是另開一份模板。
 */
export interface HeaderTemplate {
  id: string
  name: string
  status: TemplateStatus
  /** 站台預設。每站至多一份。 */
  isSiteDefault: boolean
  version: number
  updatedAt: string
  note?: string
}

export interface HeaderTemplateEntity extends HeaderTemplate {
  content: BlockInstance[]
}

/** 可改的欄位。沒有生效條件、沒有 SEO、沒有外框覆寫。 */
export interface HeaderPatch {
  name?: string
  content?: BlockInstance[]
}
