import { Descriptions } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import type { ModalFuncProps } from 'antd'
import { hasUtm } from '../../../service/storefront/home-page'
import type { Targeting, UtmRule } from '../../../service/storefront/home-page'

// 首頁模板的發布防呆:名稱放標題,攤開生效資訊(檔期 / 受眾 / 來源 / 優先序 / 外框)。
// 外框(頁首 / 頁尾)沒有這些維度,各自有自己的版本。

export function scheduleText(t?: Targeting): string {
  const s = t?.schedule
  if (!s?.start && !s?.end) return '常態（無時間限制）'
  const f = (iso?: string) => (iso ? iso.slice(0, 16).replace('T', ' ') : '—')
  return `${f(s.start)} ~ ${f(s.end)}`
}
export function audienceText(t?: Targeting): string {
  const l = t?.audience?.login
  return l === 'required' ? '已登入會員' : l === 'guest' ? '未登入訪客' : '不分'
}
// 一組 UTM 的設定欄位 → 「utm_source=fb＋utm_medium=cpc」(組內 AND 用「＋」)。
function utmRuleText(r: UtmRule): string {
  const kv: string[] = []
  if (r.source) kv.push(`utm_source=${r.source}`)
  if (r.medium) kv.push(`utm_medium=${r.medium}`)
  if (r.campaign) kv.push(`utm_campaign=${r.campaign}`)
  if (r.term) kv.push(`utm_term=${r.term}`)
  if (r.content) kv.push(`utm_content=${r.content}`)
  return kv.join('＋')
}
export function sourceText(t?: Targeting): string {
  const s = t?.source
  const parts: string[] = []
  if (hasUtm(s?.utm)) {
    // 多組之間為 OR,用「或」串;只列有內容的組。
    const groups = s!.utm!.map(utmRuleText).filter(Boolean).join('　或　')
    parts.push(`UTM（${groups}）`)
  }
  if (s?.geo?.length) parts.push(`地區 ${s.geo.join('、')}`)
  return parts.length ? parts.join('、') : '不限'
}
// 外框是兩個獨立的覆寫,可以只指定其中一個 —— 所以分開講,不合併成一句。
function chromeText(headerTemplateId?: string, footerTemplateId?: string): string {
  return `頁首 ${headerTemplateId ? '指定' : '站台預設'}、頁尾 ${footerTemplateId ? '指定' : '站台預設'}`
}

function FreezeNote() {
  return (
    <div className="flex items-start gap-2 rounded-md bg-[#fff7e6] p-3 text-sm leading-relaxed text-[#ad6800]">
      <ExclamationCircleOutlined className="mt-1 shrink-0" />
      <span>
        發布後內容與設定即鎖定，無法再修改。
        <br />
        需調整請複製新版再改。
      </span>
    </div>
  )
}

type PublishSummaryProps = {
  targeting?: Targeting
  headerTemplateId?: string
  footerTemplateId?: string
}

function PublishSummary({ targeting, headerTemplateId, footerTemplateId }: PublishSummaryProps) {
  return (
    <div className="mt-2 flex flex-col gap-4">
      <Descriptions
        column={1}
        size="small"
        styles={{ label: { width: 80, color: '#8c8c8c' } }}
        items={[
          { key: 'schedule', label: '生效時間', children: scheduleText(targeting) },
          { key: 'audience', label: '受眾', children: audienceText(targeting) },
          { key: 'source', label: '來源', children: sourceText(targeting) },
          { key: 'priority', label: '優先序', children: targeting?.priority ?? 0 },
          {
            key: 'chrome',
            label: '頁面外框',
            children: chromeText(headerTemplateId, footerTemplateId),
          },
        ]}
      />
      <FreezeNote />
    </div>
  )
}

// gen*:從模板資料產生 antd Modal 的設定物件(衍生值,不改動輸入)。
export function genHomePublishConfirm(
  opts: {
    name: string
    targeting?: Targeting
    headerTemplateId?: string
    footerTemplateId?: string
  },
  onOk: () => Promise<unknown> | void,
): ModalFuncProps {
  return {
    title: `確認發布「${opts.name || '未命名'}」?`,
    width: 460,
    icon: null,
    content: (
      <PublishSummary
        targeting={opts.targeting}
        headerTemplateId={opts.headerTemplateId}
        footerTemplateId={opts.footerTemplateId}
      />
    ),
    okText: '確認發布',
    cancelText: '取消',
    onOk,
  }
}
