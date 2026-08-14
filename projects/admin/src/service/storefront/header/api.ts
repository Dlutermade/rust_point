import { http } from '../../../shared/http'
import type { AuditEntry, BlockInstance } from '../shared/types'
import type { HeaderPatch, HeaderTemplate, HeaderTemplateEntity } from './types'

// 頁首模板 API。假資料見 mock/storefront/header.mock.ts。
export const headerApi = {
  list: () => http.get<HeaderTemplate[]>('/headers').then((r) => r.data),
  get: (id: string) => http.get<HeaderTemplateEntity>(`/headers/${id}`).then((r) => r.data),
  /** 一次帶齊內容;`copyFrom` 只影響異動紀錄(記成 duplicate 並註明來源)。 */
  create: (patch: HeaderPatch & { name: string; copyFrom?: string }) =>
    http.post<HeaderTemplate>('/headers', patch).then((r) => r.data),
  saveDraft: (id: string, patch: HeaderPatch) =>
    http.patch<HeaderTemplate>(`/headers/${id}/draft`, patch).then((r) => r.data),
  publish: (id: string, patch: HeaderPatch) =>
    http.post<HeaderTemplate>(`/headers/${id}/publish`, patch).then((r) => r.data),
  setSiteDefault: (id: string) =>
    http.post<HeaderTemplate>(`/headers/${id}/site-default`).then((r) => r.data),
  pause: (id: string) => http.post<HeaderTemplate>(`/headers/${id}/pause`).then((r) => r.data),
  resume: (id: string) => http.post<HeaderTemplate>(`/headers/${id}/resume`).then((r) => r.data),
  remove: (id: string) => http.delete(`/headers/${id}`).then(() => undefined),
  audit: (id: string) => http.get<AuditEntry[]>(`/headers/${id}/audit`).then((r) => r.data),
  content: (id: string) => http.get<BlockInstance[]>(`/headers/${id}/content`).then((r) => r.data),
  /** 站台預設那一份的內容 —— 首頁沒覆寫外框時,預覽要疊的就是它。 */
  siteDefaultContent: () =>
    http.get<BlockInstance[]>('/headers/site-default-content').then((r) => r.data),
}
