import { ProLayout } from '@ant-design/pro-components'
import {
  FileTextOutlined,
  HomeOutlined,
  LayoutOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { SITE_NAME } from '../shared/head'

// 後台外殼交給 ProLayout:側邊選單 / 頂部 / 麵包屑都由 pro 管;選單項接 TanStack Router 的 Link。
const MENU_ROUTE = {
  path: '/',
  routes: [
    {
      path: '/pages',
      name: '頁面管理',
      icon: <FileTextOutlined />,
      routes: [
        { path: '/pages/header', name: '頁首設定', icon: <LayoutOutlined /> },
        { path: '/pages/footer', name: '頁尾設定', icon: <LayoutOutlined /> },
        { path: '/pages/home', name: '首頁模板', icon: <HomeOutlined /> },
      ],
    },
    { path: '/helps', name: '幫助中心', icon: <QuestionCircleOutlined /> },
  ],
}

export function BaseLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <ProLayout
      // 不傳 title:ProLayout 會拿它去指令式改寫 document.title,而且是跟著「選單項」比對,
      // 不在選單裡的頁面(詳細 / 新建)就只剩站名。標題一律由各 route 的 head 宣告
      // (見 shared/head.ts);品牌改用 headerTitleRender 自己畫在頂欄,
      // 不畫的話 ProLayout 會掉回預設的「Ant Design Pro」。
      title={undefined}
      logo={false}
      pageTitleRender={false}
      headerTitleRender={() => <h1 className="m-0 text-base font-semibold">{SITE_NAME}</h1>}
      layout="mix"
      fixedHeader
      fixSiderbar
      contentWidth="Fluid"
      location={{ pathname }}
      route={MENU_ROUTE}
      menuItemRender={(item, dom) => (item.path ? <Link to={item.path}>{dom}</Link> : dom)}
    >
      <Outlet />
    </ProLayout>
  )
}
