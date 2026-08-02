import { css, html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../register-element'
import type { BlockType } from '../contract'
import { SfBlockElement } from '../block-element'
import { resetStyles } from '../reset'

export interface TextData {
  text?: string
  align?: 'left' | 'center' | 'right'
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
      }
    `,
  ]

  render() {
    const d = this.data
    return html`<p
      class="text"
      style="text-align:${d.align ?? 'left'};color:${d.color ?? '#333'}"
    >${d.text ?? ''}</p>`
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
