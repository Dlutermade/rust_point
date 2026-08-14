import { http } from '../../../shared/http'
import type { AuditEntry, BlockInstance } from '../shared/types'
import type { FooterPatch, FooterTemplate, FooterTemplateEntity } from './types'

// 頁尾模板 API。假資料見 mock/storefront/footer.mock.ts。
export const footerApi = {
  list: () => http.get<FooterTemplate[]>('/footers').then((r) => r.data),
  get: (id: string) => http.get<FooterTemplateEntity>(`/footers/${id}`).then((r) => r.data),
  /** 一次帶齊內容;`copyFrom` 只影響異動紀錄(記成 duplicate 並註明來源)。 */
  create: (patch: FooterPatch & { name: string; copyFrom?: string }) =>
    http.post<FooterTemplate>('/footers', patch).then((r) => r.data),
  saveDraft: (id: string, patch: FooterPatch) =>
    http.patch<FooterTemplate>(`/footers/${id}/draft`, patch).then((r) => r.data),
  publish: (id: string, patch: FooterPatch) =>
    http.post<FooterTemplate>(`/footers/${id}/publish`, patch).then((r) => r.data),
  setSiteDefault: (id: string) =>
    http.post<FooterTemplate>(`/footers/${id}/site-default`).then((r) => r.data),
  pause: (id: string) => http.post<FooterTemplate>(`/footers/${id}/pause`).then((r) => r.data),
  resume: (id: string) => http.post<FooterTemplate>(`/footers/${id}/resume`).then((r) => r.data),
  remove: (id: string) => http.delete(`/footers/${id}`).then(() => undefined),
  audit: (id: string) => http.get<AuditEntry[]>(`/footers/${id}/audit`).then((r) => r.data),
  content: (id: string) => http.get<BlockInstance[]>(`/footers/${id}/content`).then((r) => r.data),
  /** 站台預設那一份的內容 —— 首頁沒覆寫外框時,預覽要疊的就是它。 */
  siteDefaultContent: () =>
    http.get<BlockInstance[]>('/footers/site-default-content').then((r) => r.data),
}
