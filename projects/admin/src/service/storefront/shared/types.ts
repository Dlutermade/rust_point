// 前台中心(storefront)內跨模組共用的型別。
//
// 只放「三個模板模組都用得到」的東西。單一模組專屬的(首頁的生效條件、
// 頁首的站台預設)放各自的 types.ts —— 模組刪掉時型別要能跟著走。
//
// 這裡刻意不是全域 shared:BlockInstance 是前台中心的概念,
// 商品中心 / 訂單中心不會用到。

// 模板狀態:草稿(可編)→ 已發布 active(凍結、上線)⇄ 暫停 paused(凍結、不上線)。
export type TemplateStatus = 'draft' | 'active' | 'paused'

// ── 裝置 ──────────────────────────────────────────────────────────────

export type Device = 'desktop' | 'mobile'

/** 分裝置設定值:電腦與手機各存一份。哪些欄位可分裝置由該區塊型別的 schema 宣告。 */
export interface PerDevice<T> {
  desktop: T
  mobile: T
}

/**
 * 顯示裝置。做「電腦橫向選單、手機漢堡鈕」這種**結構差異**用 ——
 * 分裝置設定值只能改數值,改不掉結構。
 *
 * 刻意是三值而非 optional:`undefined` 與 `'all'` 若都表示「全部裝置」,
 * 同一個語意就有兩種寫法。
 */
export type DeviceVisibility = 'all' | 'desktop' | 'mobile'

// ── 異動紀錄 ──────────────────────────────────────────────────────────

// v1 無帳號系統,先不記 who。
// 各模組的合法子集不同:priority 只有首頁,set-site-default 只有頁首 / 頁尾。
export type AuditAction =
  | 'create'
  | 'save-draft'
  | 'publish'
  | 'duplicate'
  | 'priority'
  | 'pause'
  | 'resume'
  | 'set-site-default'

export interface AuditEntry {
  id: string
  templateId: string
  action: AuditAction
  detail?: string
  at: string
}

// ── 區塊實例 ──────────────────────────────────────────────────────────

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
// data 對應該區塊的 schema 欄位;children 供容器巢狀。
export interface BlockInstance {
  id: string
  type: string
  /** schema 欄位值。標了 perDevice 的欄位存 `PerDevice<T>`,其餘存裸值。 */
  data: Record<string, unknown>
  /** 尺寸:電腦與手機各一份。 */
  size?: PerDevice<BlockSize>
  /** 疊層位置:電腦與手機各一份。 */
  pos?: PerDevice<Pos9>
  /** 顯示裝置。必填 —— 見 DeviceVisibility 的說明。 */
  visibility: DeviceVisibility
  children?: BlockInstance[]
  /** 使用者自訂圖層名(樹 / 選取浮層優先顯示;空 = 退回自動提示 / 型別名)。 */
  name?: string
}
