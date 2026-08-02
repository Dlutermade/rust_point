import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { ConfigProvider, App as AntdApp } from 'antd'
import zhTW from 'antd/locale/zh_TW'
// 自帶 Noto Sans TC(免使用者安裝)。用分塊版(400/500/700):字型切成數十個 unicode-range 小檔,
// 瀏覽器只抓畫面實際出現的字塊 —— 免整包 1.3MB 一次載。
import '@fontsource/noto-sans-tc/400.css'
import '@fontsource/noto-sans-tc/500.css'
import '@fontsource/noto-sans-tc/700.css'
import { router } from './router'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
})

// CJK 優先的字型堆疊:Windows 走微軟正黑、Mac 走蘋方,避免 fallback 到細明體那種醜字。
const FONT_FAMILY =
  '"Noto Sans TC", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Microsoft JhengHei", Roboto, "Helvetica Neue", Arial, sans-serif'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhTW}
      theme={{
        token: { colorPrimary: '#1677ff', fontFamily: FONT_FAMILY, fontSize: 16, lineHeight: 1.6 },
      }}
    >
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
)
