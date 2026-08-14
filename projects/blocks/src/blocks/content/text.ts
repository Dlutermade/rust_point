import { css, html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../../core/register-element'
import type { BlockType, MaybePerDevice } from '../../contract'
import { genDeviceVars } from '../../contract'
import { SfBlockElement } from '../../core/block-element'
import { resetStyles } from '../../styles/reset'
import { mobileQuery } from '../../styles/device'

export interface TextData {
  text?: string
  align?: MaybePerDevice<'left' | 'center' | 'right'>
  color?: string
}

@customElement('sf-text')
export class SfText extends SfBlockElement {
  protected blockType = 'text'

  @property({ type: Object }) data: TextData = {}

  static styles = [
    resetStyles,
    css`
      :host {
        display: block;
      }
      .text {
        font-size: 16px;
        line-height: 1.7;
        white-space: pre-wrap;
        text-align: var(--sf-align);
      }
      ${mobileQuery} {
        .text {
          text-align: var(--sf-align-m, var(--sf-align));
        }
      }
    `,
  ]

  render() {
    const d = this.data
    const vars = genDeviceVars(d, (dd) => ({ align: dd.align ?? 'left' }))
    const style = `${vars};color:${d.color ?? '#333'}`
    // 內文是 pre-wrap,標籤與 ${} 之間不能有換行縮排 —— 那些空白會被原樣渲染成空行。
    return html`<p class="text" style=${style}>${d.text ?? ''}</p>`
  }
}

export const textType: BlockType = {
  type: 'text',
  name: '文字',
  tag: 'sf-text',
  schema: {
    fields: [
      { key: 'text', label: '內容', type: 'textarea' },
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
  defaults: { text: '在這裡輸入文字…', align: 'left' },
}

declare global {
  interface HTMLElementTagNameMap {
    'sf-text': SfText
  }
}
