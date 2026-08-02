// 模板狀態:草稿(可編)→ 已發布 active(凍結、上線)⇄ 暫停 paused(凍結、不上線)。
export type TemplateStatus = 'draft' | 'active' | 'paused'

// 版位:首頁 / 頁首 / 頁尾。每個版位可有多個模板;哪個生效由 resolve 依規則算出(見 docs technical/10)。
export type SlotKind = 'home' | 'header' | 'footer'

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
// 模板才是實體;「變體」是同一實體依情況(檔期/受眾/來源)解析出的呈現,不是獨立的列。
export interface Targeting {
  schedule?: { start?: string; end?: string }
  audience?: { login?: 'required' | 'guest' } // 省略 = 不判斷
  source?: { utm?: UtmRule[]; geo?: string[] }
  priority?: number
}

// 外框覆寫(Model B):頁面可挑自己的頁首/頁尾模板;不設 = 吃站台預設。
export interface ChromeOverride {
  headerId?: string
  footerId?: string
}

// 頁面模板(實體)。列表用精簡投影;進編輯器打實體 API 一次拿全(見 PageTemplateEntity)。
export interface PageTemplate {
  id: string
  slot: SlotKind
  name: string
  status: TemplateStatus
  /** 頁面用:完整生效條件。頁首/頁尾(外框)不用這個。 */
  targeting?: Targeting
  /** 頁首/頁尾用:是否為站台預設。頁面用:常態版(永久兜底)。 */
  isDefault?: boolean
  /** 頁面用:覆寫要套的頁首/頁尾;不設 = 站台預設。 */
  chrome?: ChromeOverride
  version: number
  updatedAt: string
  note?: string
}

// 異動紀錄(v1 無登入系統,先不記 who)。
export type AuditAction =
  | 'create'
  | 'save-draft'
  | 'publish'
  | 'duplicate'
  | 'priority'
  | 'pause'
  | 'resume'
  | 'set-default'
export interface AuditEntry {
  id: string
  templateId: string
  action: AuditAction
  detail?: string
  at: string
}

// Framer 式尺寸:每個區塊的寬/高可為 填滿 / 貼齊內容 / 固定。
export type SizeMode = 'fill' | 'hug' | 'fixed'

export interface BlockSize {
  w?: SizeMode
  h?: SizeMode
  wPx?: number
  hPx?: number
}

// 在「疊層」中的 9 宮格位置(僅當父層是疊層時生效)。
export type Pos9 =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right'

// 模板內容 = 區塊實例樹。type 對應 @sc/blocks 的 BlockType.type;
// data 對應該區塊的 schema 欄位;children 供 container 巢狀。
export interface BlockInstance {
  id: string
  type: string
  data: Record<string, unknown>
  size?: BlockSize
  pos?: Pos9
  children?: BlockInstance[]
  /** 使用者自訂圖層名(樹 / 選取浮層優先顯示;空 = 退回自動提示 / 型別名)。 */
  name?: string
}

// 模板的「實體」表現:進編輯器打實體 API 一次拿全(投影欄位 + content)。
export interface PageTemplateEntity extends PageTemplate {
  content: BlockInstance[]
}
