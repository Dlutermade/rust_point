import { HeadContent, Outlet, createRootRoute } from '@tanstack/react-router'
import { SITE_NAME } from '../shared/head'

// root 只放 head 出口 + Outlet;帶後台 chrome 的頁面掛在 _layout 版面下,編輯器直掛 root(全螢幕)。
// HeadContent 由葉往根取第一個 title,子路由宣告的會蓋過這裡的保底值。
// 標題只在這裡出 —— index.html 刻意不放 <title>:瀏覽器取文件裡第一個 title,
// 靜態的那個會贏過 HeadContent 掛上去的,初次載入就會顯示保底值而不是該頁標題。
export const Route = createRootRoute({
  head: () => ({ meta: [{ title: SITE_NAME }] }),
  component: () => (
    <>
      <HeadContent />
      <Outlet />
    </>
  ),
})
