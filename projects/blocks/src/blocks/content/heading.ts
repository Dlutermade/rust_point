import { css, html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../../core/register-element'
import type { BlockType, MaybePerDevice } from '../../contract'
import { genDeviceVars } from '../../contract'
import { SfBlockElement } from '../../core/block-element'
import { resetStyles } from '../../styles/reset'
import { mobileQuery } from '../../styles/device'

export interface HeadingData {
  text?: string
  /**
   * 標題層級**刻意不分裝置** —— h1/h2/h3 是語意與 SEO 大綱,
   * 隨裝置變會同時弄壞搜尋引擎的結構理解與螢幕閱讀器的導覽。
   */
  level?: 'h1' | 'h2' | 'h3'
  align?: MaybePerDevice<'left' | 'center' | 'right'>
  color?: string
}

@customElement('sf-heading')
export class SfHeading extends SfBlockElement {
  protected blockType = 'heading'

  @property({ type: Object }) data: HeadingData = {}

  static styles = css`
    ${resetStyles}
    :host {
      display: block;
    }
    .h {
      font-weight: 700;
      text-align: var(--sf-align);
    }
    ${mobileQuery} {
      .h {
        text-align: var(--sf-align-m, var(--sf-align));
      }
    }
    .h1 {
      font-size: 32px;
    }
    .h2 {
      font-size: 24px;
    }
    .h3 {
      font-size: 19px;
    }
  `

  render() {
    const d = this.data
    const level = d.level ?? 'h2'
    const cls = `h ${level}`
    const vars = genDeviceVars(d, (dd) => ({ align: dd.align ?? 'left' }))
    const style = `${vars};color:${d.color ?? '#1a1a1a'}`
    const text = d.text ?? '標題文字'
    // 依 level 出對應標題標籤(SEO)
    if (level === 'h1') return html`<h1 class=${cls} style=${style}>${text}</h1>`
    if (level === 'h3') return html`<h3 class=${cls} style=${style}>${text}</h3>`
    return html`<h2 class=${cls} style=${style}>${text}</h2>`
  }
}

export const headingType: BlockType = {
  type: 'heading',
  name: '標題',
  tag: 'sf-heading',
  schema: {
    fields: [
      { key: 'text', label: '文字', type: 'text' },
      {
        key: 'level',
        label: '層級',
        type: 'select',
        options: [
          { label: 'H1', value: 'h1' },
          { label: 'H2', value: 'h2' },
          { label: 'H3', value: 'h3' },
        ],
      },
      {
        key: 'align',
        label: '對齊',
        type: 'select',
        perDevice: true,
        options: [
          { label: '靠左', value: 'left' },
          { label: '置中', value: 'center' },
          { label: '靠右', value: 'right' },
        ],
      },
      { key: 'color', label: '文字顏色', type: 'color' },
    ],
  },
  defaults: { text: '標題文字', level: 'h2', align: 'left' },
}

declare global {
  interface HTMLElementTagNameMap {
    'sf-heading': SfHeading
  }
}
