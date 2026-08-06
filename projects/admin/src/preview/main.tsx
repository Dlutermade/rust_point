import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { consoleSink, installEventRouter, setContext } from '@sc/blocks'
import type { SfEvent } from '@sc/blocks'
import type { BlockInstance } from '../api/types'
import { getActiveLayoutContent, getTemplate, getTemplateDraft } from '../api/mock'
import { readPreviewScratch } from './scratch'
import { logger } from '../shared/logger'
import { BlockView } from '../components/block-editor/BlockView'

const log = logger('preview')

// 獨立打包端點(preview.html):模擬前台,刻意不掛 admin 的 router / antd / react-query,
// 避免兩個 SPA 互相汙染(共用 provider / 全域監聽 / 路由狀態)。模板 id 由 query 帶:?template=xxx。
interface Loaded {
  isHome: boolean
  content: BlockInstance[]
  header: BlockInstance[]
  footer: BlockInstance[]
}

function Preview() {
  const params = new URLSearchParams(globalThis.location.search)
  const templateId = params.get('template') ?? ''
  // ?preview=1 → 讀編輯器寫的 client 暫存(當前編輯樣子),不讀 server。
  const isPreview = params.get('preview') === '1'
  const [data, setData] = useState<Loaded | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const template = await getTemplate(templateId)
      const isHome = template?.slot === 'home'
      const [content, header, footer] = await Promise.all([
        isPreview ? Promise.resolve(readPreviewScratch()) : getTemplateDraft(templateId),
        isHome ? getActiveLayoutContent('header') : Promise.resolve([]),
        isHome ? getActiveLayoutContent('footer') : Promise.resolve([]),
      ])
      if (alive) setData({ isHome, content, header, footer })
    })()
    return () => {
      alive = false
    }
  }, [templateId, isPreview])

  useEffect(() => {
    setContext({ tenantId: 'preview', pageType: 'home', templateVariant: templateId })
    const uninstall = installEventRouter(document, {
      execute: (e: SfEvent) => {
        if (e.name === 'view_promotion' || e.name === 'block_hover') return
        log.info(`(模擬前台)${e.name}`, e.params ?? {})
      },
      sinks: [consoleSink],
    })
    return uninstall
  }, [templateId])

  if (!data) return <div style={{ padding: 64, textAlign: 'center', color: '#999' }}>載入中…</div>

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      {data.isHome && data.header.map((b) => <BlockView key={b.id} instance={b} />)}
      {data.content.map((b) => (
        <BlockView key={b.id} instance={b} />
      ))}
      {data.isHome && data.footer.map((b) => <BlockView key={b.id} instance={b} />)}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
)
