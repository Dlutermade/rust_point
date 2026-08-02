import type { BlockInstance } from '../api/types'

// 預覽暫存(client-only channel):編輯器把「當前 blocks」寫這、預覽分頁讀這。
// 不是 server —— 預覽只是看當前樣子,絕不持久化(儲存草稿才走 server)。
const KEY = 'sf:preview'

export function writePreviewScratch(blocks: BlockInstance[]): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(blocks))
  } catch {
    /* 忽略 */
  }
}

export function readPreviewScratch(): BlockInstance[] {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]') as BlockInstance[]
  } catch {
    return []
  }
}
