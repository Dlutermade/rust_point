import type { BlockInstance, ChromeOverride, Targeting } from './types'
import {
  createDraft,
  deleteTemplate,
  getActiveLayoutContent,
  getAudit,
  getTemplate,
  getTemplateDraft,
  listTemplates,
  pauseTemplate,
  publish,
  resumeTemplate,
  saveDraft,
  updatePriority,
} from './mock'

// 首頁資源 API —— 明確、獨立,不吃 slot 參數。真後端接上就換這一層,路由/元件不動。
export const homeApi = {
  list: () => listTemplates('home'),
  get: (id: string) => getTemplate(id),
  createDraft: (name: string) => createDraft('home', name),
  saveDraft: (
    id: string,
    patch: {
      content?: BlockInstance[]
      targeting?: Targeting
      chrome?: ChromeOverride
      name?: string
    },
  ) => saveDraft(id, patch),
  publish: (id: string, patch: { content?: BlockInstance[]; targeting?: Targeting }) =>
    publish(id, patch),
  updatePriority: (id: string, priority: number) => updatePriority(id, priority),
  pause: (id: string) => pauseTemplate(id),
  resume: (id: string) => resumeTemplate(id),
  remove: (id: string) => deleteTemplate(id),
  audit: (id: string) => getAudit(id),
  // 站台預設外框:頁面沒覆寫時,疊上站台預設的頁首/頁尾當預覽上下文。
  activeHeader: () => getActiveLayoutContent('header'),
  activeFooter: () => getActiveLayoutContent('footer'),
  // 頁面覆寫(Model B):可挑選要套哪個頁首/頁尾。選項清單 + 依 id 取內容。
  headerOptions: () => listTemplates('header'),
  footerOptions: () => listTemplates('footer'),
  layoutContent: (id: string) => getTemplateDraft(id),
}
