import { Tag } from 'antd'

type KbdProps = { children: string }

// 鍵盤按鍵樣式。跨領域的 UI 原語 —— 不屬於 page-template 也不屬於 block-editor,
// 所以住在 components/ui/(編輯器之後要做快捷鍵提示也會用到)。
export function Kbd({ children }: KbdProps) {
  return <Tag className="font-mono">{children}</Tag>
}
