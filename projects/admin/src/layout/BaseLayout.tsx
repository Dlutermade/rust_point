import { ProLayout } from '@ant-design/pro-components'
import {
  FileTextOutlined,
  HomeOutlined,
  LayoutOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'

// 後台外殼交給 ProLayout:側邊選單 / 頂部 / 麵包屑都由 pro 管;選單項接 TanStack Router 的 Link。
const menuRoute = {
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
      title="電商後台"
      logo={false}
      layout="mix"
      fixedHeader
      fixSiderbar
      contentWidth="Fluid"
      location={{ pathname }}
      route={menuRoute}
      menuItemRender={(item, dom) => (item.path ? <Link to={item.path}>{dom}</Link> : dom)}
    >
      <Outlet />
    </ProLayout>
  )
}
