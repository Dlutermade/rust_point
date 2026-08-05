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
        // fontSize 沿用 antd 預設 14:字級階梯(fontSizeLG / heading 系列)全由它推導,
        // 調成 16 會讓整個後台連標題、表格一起放大。lineHeight 略放寬給中文喘息空間。
        // ⚠️ 改這個值時 index.css 的 body font-size 要一起改 —— antd 的 cssVar 變數掛在它自己
        // 產生的 scope class 上,body 讀不到,所以非 antd 區域只能另外對齊。
        token: { colorPrimary: '#1677ff', fontFamily: FONT_FAMILY, fontSize: 14, lineHeight: 1.6 },
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
