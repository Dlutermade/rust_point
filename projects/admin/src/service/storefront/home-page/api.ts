import { http } from '../../../shared/http'
import type { AuditEntry, BlockInstance } from '../shared/types'
import type { HomePagePatch, HomePageTemplate, HomePageTemplateEntity } from './types'

// 首頁模板 API —— 明確、獨立,不吃版位參數(後端路由也是這個形狀)。
//
// 只有一條路徑:一律打 http。dev 環境的假資料由 vite-plugin-mock-dev-server
// 在 dev server 層攔截(見 mock/storefront/home-page.mock.ts),這裡不帶 mock 分支。
export const homePageApi = {
  list: () => http.get<HomePageTemplate[]>('/home-pages').then((r) => r.data),
  get: (id: string) => http.get<HomePageTemplateEntity>(`/home-pages/${id}`).then((r) => r.data),
  /**
   * 建立。一次帶齊內容 —— 不必先建空殼再補一趟 save-draft。
   *
   * `copyFrom` 只影響異動紀錄(記成 `duplicate` 並註明來源),不影響寫入的內容:
   * 複製流程是前端把來源載進表單、使用者改完才送出,所以送來的內容已經是最終版。
   */
  create: (patch: HomePagePatch & { name: string; copyFrom?: string }) =>
    http.post<HomePageTemplate>('/home-pages', patch).then((r) => r.data),
  saveDraft: (id: string, patch: HomePagePatch) =>
    http.patch<HomePageTemplate>(`/home-pages/${id}/draft`, patch).then((r) => r.data),
  publish: (id: string, patch: HomePagePatch) =>
    http.post<HomePageTemplate>(`/home-pages/${id}/publish`, patch).then((r) => r.data),
  updatePriority: (id: string, priority: number) =>
    http.put<HomePageTemplate>(`/home-pages/${id}/priority`, { priority }).then((r) => r.data),
  pause: (id: string) => http.post<HomePageTemplate>(`/home-pages/${id}/pause`).then((r) => r.data),
  resume: (id: string) =>
    http.post<HomePageTemplate>(`/home-pages/${id}/resume`).then((r) => r.data),
  remove: (id: string) => http.delete(`/home-pages/${id}`).then(() => undefined),
  audit: (id: string) => http.get<AuditEntry[]>(`/home-pages/${id}/audit`).then((r) => r.data),
  content: (id: string) =>
    http.get<BlockInstance[]>(`/home-pages/${id}/content`).then((r) => r.data),
}
