import { createFileRoute } from '@tanstack/react-router'
import { BaseLayout } from '../../layout/BaseLayout'

// 無路徑版面(pathless layout):套基礎版面(側欄 + Header),其下頁面渲染進 <Outlet/>。
export const Route = createFileRoute('/_layout')({
  component: BaseLayout,
})
