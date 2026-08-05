import { Descriptions } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import type { ModalFuncProps } from 'antd'
import type { ChromeOverride, Targeting, UtmRule } from '../../api/types'
import { hasUtm } from '../../api/resolve'

// 發布前的防呆:名稱放標題;頁面才攤生效資訊,外框只留一句凍結提醒。

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
function chromeText(c?: ChromeOverride): string {
  return `頁首 ${c?.headerId ? '指定' : '站台預設'}、頁尾 ${c?.footerId ? '指定' : '站台預設'}`
}

function FreezeNote({ kind }: { kind: 'page' | 'chrome' }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-[#fff7e6] p-3 text-sm leading-relaxed text-[#ad6800]">
      <ExclamationCircleOutlined className="mt-1 shrink-0" />
      <span>
        {kind === 'page'
          ? '發布後內容與設定即鎖定，無法再修改。'
          : '發布後即鎖定，且不會自動設為站台預設。'}
        <br />
        需調整請複製新版再改。
      </span>
    </div>
  )
}

function PublishSummary({
  targeting,
  chrome,
  kind,
}: {
  targeting?: Targeting
  chrome?: ChromeOverride
  kind: 'page' | 'chrome'
}) {
  return (
    <div className="mt-2 flex flex-col gap-4">
      {kind === 'page' && (
        <Descriptions column={1} size="small" labelStyle={{ width: 80, color: '#8c8c8c' }}>
          <Descriptions.Item label="生效時間">{scheduleText(targeting)}</Descriptions.Item>
          <Descriptions.Item label="受眾">{audienceText(targeting)}</Descriptions.Item>
          <Descriptions.Item label="來源">{sourceText(targeting)}</Descriptions.Item>
          <Descriptions.Item label="優先序">{targeting?.priority ?? 0}</Descriptions.Item>
          <Descriptions.Item label="頁面外框">{chromeText(chrome)}</Descriptions.Item>
        </Descriptions>
      )}
      <FreezeNote kind={kind} />
    </div>
  )
}

export function buildPublishConfirm(
  opts: { name: string; targeting?: Targeting; chrome?: ChromeOverride; kind: 'page' | 'chrome' },
  onOk: () => Promise<unknown> | void,
): ModalFuncProps {
  return {
    title: `確認發布「${opts.name || '未命名'}」?`,
    width: 460,
    icon: null,
    content: <PublishSummary targeting={opts.targeting} chrome={opts.chrome} kind={opts.kind} />,
    okText: '確認發布',
    cancelText: '取消',
    onOk,
  }
}
