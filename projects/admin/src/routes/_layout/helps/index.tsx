import { Card, Typography } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { createFileRoute, Link } from '@tanstack/react-router'
import { pageTitle } from '../../../shared/head'

const { Title, Paragraph } = Typography

// /helps — 幫助中心首頁:教學主題清單。
export const Route = createFileRoute('/_layout/helps/')({
  head: () => ({ meta: [{ title: pageTitle('幫助中心') }] }),
  component: HelpCenter,
})

const topics = [
  {
    to: '/helps/page-editor',
    icon: <EditOutlined />,
    title: '頁面編輯器',
    desc: '積木、圖層樹、拖曳排版、設定面板、草稿與發布、快捷鍵。',
  },
]

function HelpCenter() {
  return (
    <div className="mx-auto max-w-205">
      <Typography>
        <Title level={2}>幫助中心</Title>
        <Paragraph type="secondary">教你怎麼操作後台。之後每個功能都會有一篇。</Paragraph>
      </Typography>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {topics.map((topic) => (
          <Link key={topic.to} to={topic.to}>
            <Card hoverable size="small">
              <div className="flex items-center gap-2 text-base font-semibold">
                <span className="text-brand">{topic.icon}</span>
                {topic.title}
              </div>
              <div className="mt-1 text-sm text-[#888]">{topic.desc}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
