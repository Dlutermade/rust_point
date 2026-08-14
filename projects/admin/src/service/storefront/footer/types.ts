import type { BlockInstance, TemplateStatus } from '../shared/types'

/**
 * 頁尾模板。語意同頁首,但**不是同一類東西**(見 docs business/03)——
 * 現在欄位剛好一樣,不代表以後一樣(頁尾的多欄連結配置、頁首的 sticky 行為)。
 */
export interface FooterTemplate {
  id: string
  name: string
  status: TemplateStatus
  /** 站台預設。每站至多一份。 */
  isSiteDefault: boolean
  version: number
  updatedAt: string
  note?: string
}

export interface FooterTemplateEntity extends FooterTemplate {
  content: BlockInstance[]
}

/** 可改的欄位。 */
export interface FooterPatch {
  name?: string
  content?: BlockInstance[]
}
