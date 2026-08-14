import { css, html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../../core/register-element'
import type { BlockType } from '../../contract'
import { SfBlockElement } from '../../core/block-element'

export interface DividerData {
  /**
   * 方向**不分裝置** —— 但這不是缺口:`auto` 是依父容器軸決定的,
   * 而父容器的 `direction` 可分裝置。所以「電腦橫排、手機直排」時,
   * auto 的分隔線本來就會跟著轉向,不需要自己再存兩份。
   *
   * 另外它也不是單純的 CSS 值切換:會設 host 的 orient 屬性、切換 width/height 的組合,
   * 沒辦法只靠一個 CSS 變數表達。
   */
  orientation?: 'auto' | 'horizontal' | 'vertical'
  thickness?: number
  color?: string
}

@customElement('sf-divider')
export class SfDivider extends SfBlockElement {
  protected blockType = 'divider'

  @property({ type: Object }) data: DividerData = {}
  // 父層軸(由外層明確傳入:'row' / 'column');比嗅探 DOM 可靠,且父層改向時會反應。
  @property({ attribute: 'parent-axis' }) parentAxis = ''

  // 線畫在 shadow DOM 內層,粗細/顏色由 render 直接寫死 —— 不靠 host 的 inline style,
  // 因為外層(BlockView)會覆寫 host 的 style 屬性(width/height/flex),會把 host 上的設定洗掉。
  static styles = css`
    :host {
      display: block;
    }
    :host([orient='vertical']) {
      align-self: stretch;
      margin: 0 8px;
    }
    :host([orient='horizontal']) {
      margin: 8px 0;
    }
    .line {
      box-sizing: border-box;
    }
  `

  connectedCallback(): void {
    super.connectedCallback()
    // 沒有 parent-axis 時(WC 單獨使用)等 slot 指派完再算一次自動方向。
    queueMicrotask(() => this.requestUpdate())
  }

  willUpdate(): void {
    this.setAttribute('orient', this.resolveOrientation())
  }

  // 自動:水平容器(row)→ 垂直線;垂直容器 / 一般流(flow)/ 疊層(stack)→ 水平線。
  // 優先用外層傳入的 parent-axis;沒傳才退回嗅探被 slot 進去的 flex 容器方向。
  private resolveOrientation(): 'horizontal' | 'vertical' {
    const o = this.data.orientation ?? 'auto'
    if (o === 'horizontal' || o === 'vertical') return o
    if (this.parentAxis) return this.parentAxis === 'row' ? 'vertical' : 'horizontal'
    const parent = this.assignedSlot?.parentElement
    if (parent && getComputedStyle(parent).flexDirection.startsWith('row')) return 'vertical'
    return 'horizontal'
  }

  render() {
    const d = this.data
    const t = `${d.thickness ?? 1}px`
    const c = d.color ?? '#e5e5e5'
    const style =
      this.resolveOrientation() === 'horizontal'
        ? `width:100%;height:${t};background:${c}`
        : `width:${t};height:100%;min-height:20px;background:${c}`
    return html`<div class="line" style=${style}></div>`
  }
}

export const dividerType: BlockType = {
  type: 'divider',
  name: '分隔線',
  tag: 'sf-divider',
  schema: {
    fields: [
      {
        key: 'orientation',
        label: '方向',
        type: 'select',
        options: [
          { label: '自動(依容器軸)', value: 'auto' },
          { label: '水平', value: 'horizontal' },
          { label: '垂直', value: 'vertical' },
        ],
      },
      { key: 'thickness', label: '粗度', type: 'number', min: 1, max: 20, step: 1 },
      { key: 'color', label: '顏色', type: 'color' },
    ],
  },
  defaults: { orientation: 'auto', thickness: 1, color: '#e5e5e5' },
}

declare global {
  interface HTMLElementTagNameMap {
    'sf-divider': SfDivider
  }
}
