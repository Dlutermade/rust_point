import type { BlockInstance } from './types'
import {
  createDraft,
  deleteTemplate,
  getAudit,
  getTemplate,
  listTemplates,
  pauseTemplate,
  publish,
  resumeTemplate,
  saveDraft,
  setSiteDefault,
} from './mock'

// 頁首資源 API —— 頁首是外框(Model B):只有「站台預設」,不跑完整生效。
export const headerApi = {
  list: () => listTemplates('header'),
  get: (id: string) => getTemplate(id),
  createDraft: (name: string) => createDraft('header', name),
  saveDraft: (id: string, patch: { content?: BlockInstance[]; name?: string }) =>
    saveDraft(id, patch),
  publish: (id: string, patch: { content?: BlockInstance[] }) => publish(id, patch),
  setDefault: (id: string) => setSiteDefault(id),
  pause: (id: string) => pauseTemplate(id),
  resume: (id: string) => resumeTemplate(id),
  remove: (id: string) => deleteTemplate(id),
  audit: (id: string) => getAudit(id),
}
