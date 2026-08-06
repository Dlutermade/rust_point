import { ExclamationCircleOutlined } from '@ant-design/icons'
import type { ModalFuncProps } from 'antd'

// 頁首的發布防呆。頁首是外框:沒有檔期 / 受眾 / 來源這些維度,所以不攤生效資訊,
// 只留凍結提醒 —— 並強調「發布 ≠ 生效」,還要另外設為站台預設。
function FreezeNote() {
  return (
    <div className="flex items-start gap-2 rounded-md bg-[#fff7e6] p-3 text-sm leading-relaxed text-[#ad6800]">
      <ExclamationCircleOutlined className="mt-1 shrink-0" />
      <span>
        發布後即鎖定，且不會自動設為站台預設。
        <br />
        需調整請複製新版再改。
      </span>
    </div>
  )
}

// gen*:從模板資料產生 antd Modal 的設定物件(衍生值,不改動輸入)。
export function genHeaderPublishConfirm(
  opts: { name: string },
  onOk: () => Promise<unknown> | void,
): ModalFuncProps {
  return {
    title: `確認發布「${opts.name || '未命名'}」?`,
    width: 460,
    icon: null,
    content: <FreezeNote />,
    okText: '確認發布',
    cancelText: '取消',
    onOk,
  }
}
