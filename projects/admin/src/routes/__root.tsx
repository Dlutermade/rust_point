import { Outlet, createRootRoute } from '@tanstack/react-router'

// root 只放 Outlet;帶後台 chrome 的頁面掛在 _chrome 版面下,編輯器/前台預覽直掛 root(全螢幕)。
export const Route = createRootRoute({
  component: () => <Outlet />,
})
