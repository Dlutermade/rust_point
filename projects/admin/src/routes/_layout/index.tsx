import { createFileRoute } from '@tanstack/react-router'
import { pageTitle } from '../../shared/head'

// 進站首頁 `/`(後台殼內,有側欄)。先最陽春,之後長成儀表板。
export const Route = createFileRoute('/_layout/')({
  head: () => ({ meta: [{ title: pageTitle('總覽') }] }),
  component: DashboardHome,
})

function DashboardHome() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Hello 👋</h1>
      <p className="mt-2 text-gray-500">電商後台。從左側選單開始管理頁面。</p>
    </div>
  )
}
