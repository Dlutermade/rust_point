import { Alert, Card, Steps, Tag, Typography } from 'antd'
import { createFileRoute, Link } from '@tanstack/react-router'

const { Title, Paragraph, Text } = Typography

// /helps/page-editor — 幫助中心:頁面編輯器操作教學。
export const Route = createFileRoute('/_shell/helps/page-editor')({
  component: PageEditorHelp,
})

function Kbd({ children }: { children: string }) {
  return <Tag className="font-mono">{children}</Tag>
}

function PageEditorHelp() {
  return (
    <div className="mx-auto max-w-205">
      <Typography>
        <Link to="/helps" className="text-brand">
          ← 幫助中心
        </Link>
        <Title level={2}>頁面編輯器教學</Title>
        <Paragraph type="secondary">
          頁面 = 一串「積木（區塊）」組成的樹。編輯器分三區：
          <Text strong>左</Text>＝積木庫 + 圖層樹、<Text strong>中</Text>＝畫布、
          <Text strong>右</Text>＝設定面板。
        </Paragraph>

        <Alert
          className="my-4"
          type="info"
          message="怎麼進來?"
          description="從左側選單「頁面管理」→ 選版位（首頁 / 頁首 / 頁尾）→ 列表點「新建」或「編輯」。"
        />

        <Title level={4}>操作步驟</Title>
        <Steps
          direction="vertical"
          current={-1}
          items={[
            {
              title: '加積木',
              description: '左側積木庫「點一下」直接加到選中的容器，或「拖到畫布」放在想要的位置。',
            },
            {
              title: '選取一個積木',
              description: '點畫布上的積木、或點左側圖層樹。選中會出現藍框 + 一條就近工具列。',
            },
            {
              title: '就近工具列',
              description: '⠿ 拖曳排序、選父層（往上選容器）、上移 / 下移、複製、刪除。',
            },
            {
              title: '排版（容器）',
              description:
                '把積木拖進「版面 Flex（可水平 / 垂直）」或「疊層」容器；拖曳時會出現藍色插入線提示落點。',
            },
            {
              title: '調設定（右側面板）',
              description:
                '尺寸（填滿 Fill / 貼齊 Hug / 固定 Fixed）、間距 X / Y、顏色、邊框 / 陰影（先開關、開了才展開顏色與粗細）。',
            },
            {
              title: '圖層樹',
              description:
                '在左側樹上「右鍵」→ 重新命名 / 複製 / 刪除；容器可收合。名稱會自動帶內容（如「新品」）。',
            },
            {
              title: '預覽 / 儲存 / 發布',
              description:
                '預覽＝開新分頁看「當前編輯的樣子」（不會存檔）；儲存草稿＝存起來之後可再改；發布＝上線並凍結。',
            },
          ]}
        />

        <Title level={4}>鍵盤快捷</Title>
        <Paragraph>
          <Kbd>Ctrl / ⌘ + Z</Kbd> 復原 · <Kbd>Ctrl / ⌘ + Shift + Z</Kbd> 重做 · <Kbd>Del</Kbd> 刪除
          · <Kbd>Ctrl / ⌘ + D</Kbd> 複製 · <Kbd>Ctrl / ⌘ + C / V</Kbd> 複製 / 貼上 · <Kbd>Esc</Kbd>{' '}
          取消選取
        </Paragraph>

        <Card size="small" className="my-4">
          <Text strong>桌機 / 手機</Text>：上方切換鈕可看不同裝置的排版（尺寸、間距能分別設定）。
        </Card>

        <Alert
          type="warning"
          message="發布後不可編輯"
          description="模板一經發布就凍結（內容與生效條件都不能改）。要調整請在列表點「複製」成新草稿去改——舊的留著當紀錄。"
        />
      </Typography>
    </div>
  )
}
