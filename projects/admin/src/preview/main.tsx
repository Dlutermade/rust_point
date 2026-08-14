import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { consoleSink, installEventRouter, setContext } from '@sc/blocks'
import type { SfEvent } from '@sc/blocks'
import type { BlockInstance } from '../service/storefront/shared/types'
import { homePageApi } from '../service/storefront/home-page'
import { headerApi } from '../service/storefront/header'
import { footerApi } from '../service/storefront/footer'
import { readPreviewScratch } from './scratch'
import { logger } from '../shared/logger'
import { BlockView } from '../components/block-editor/BlockView'

const log = logger('preview')

// 獨立打包端點(preview.html):模擬前台,刻意不掛 admin 的 router / antd / react-query,
// 避免兩個 SPA 互相汙染(共用 provider / 全域監聽 / 路由狀態)。
//
// query:?template=<id>&kind=home|header|footer[&preview=1]
// kind 是必要的 —— 三種模板各自一張表、id 各自獨立,單憑 id 認不出該打哪組 API。
interface Loaded {
  isHome: boolean
  content: BlockInstance[]
  header: BlockInstance[]
  footer: BlockInstance[]
}

type PreviewKind = 'home' | 'header' | 'footer'

function Preview() {
  const params = new URLSearchParams(globalThis.location.search)
  const templateId = params.get('template') ?? ''
  const kind = (params.get('kind') ?? 'home') as PreviewKind
  // ?preview=1 → 讀編輯器寫的 client 暫存(當前編輯樣子),不讀 server。
  const isPreview = params.get('preview') === '1'
  const [data, setData] = useState<Loaded | null>(null)

  useEffect(() => {
    let alive = true
    const isHome = kind === 'home'
    const loadOwnContent = (): Promise<BlockInstance[]> => {
      if (isPreview) return Promise.resolve(readPreviewScratch())
      if (kind === 'header') return headerApi.content(templateId)
      if (kind === 'footer') return footerApi.content(templateId)
      return homePageApi.content(templateId)
    }
    void (async () => {
      // 只有首頁要疊外框;編頁首 / 頁尾時預覽的就是它自己。
      const [content, header, footer] = await Promise.all([
        loadOwnContent(),
        isHome ? headerApi.siteDefaultContent() : Promise.resolve([]),
        isHome ? footerApi.siteDefaultContent() : Promise.resolve([]),
      ])
      if (alive) setData({ isHome, content, header, footer })
    })()
    return () => {
      alive = false
    }
  }, [templateId, kind, isPreview])

  useEffect(() => {
    setContext({ tenantId: 'preview', pageType: kind, templateId })
    const uninstall = installEventRouter(document, {
      execute: (e: SfEvent) => {
        if (e.name === 'view_promotion' || e.name === 'block_hover') return
        log.info(`(模擬前台)${e.name}`, e.params ?? {})
      },
      sinks: [consoleSink],
    })
    return uninstall
  }, [templateId, kind])

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
