import { css, html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../../core/register-element'
import type { BlockAction, BlockType } from '../../contract'
import { actionHref } from '../../contract'
import { SfBlockElement } from '../../core/block-element'
import { SF_EVENTS } from '../../events'
import { resetStyles } from '../../styles/reset'

export interface ButtonData {
  text?: string
  action?: BlockAction
  align?: 'left' | 'center' | 'right'
  variant?: 'primary' | 'outline'
}

@customElement('sf-button')
export class SfButton extends SfBlockElement {
  protected blockType = 'button'

  @property({ type: Object }) data: ButtonData = {}

  static styles = css`
    ${resetStyles}
    :host {
      display: block;
    }
    .wrap {
      padding: 8px 0;
    }
    .btn {
      display: inline-block;
      padding: 10px 22px;
      border-radius: 6px;
      font: inherit;
      font-size: 15px;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid #1677ff;
    }
    .primary {
      background: #1677ff;
      color: #fff;
    }
    .outline {
      background: transparent;
      color: #1677ff;
    }
  `

  render() {
    const d = this.data
    const cls = `btn ${d.variant ?? 'primary'}`
    const href = actionHref(d.action)
    const inner = d.text ?? '按鈕'
    const el = href
      ? html`<a class=${cls} href=${href} @click=${this._nav}>${inner}</a>`
      : html`<button class=${cls} type="button" @click=${this._act}>${inner}</button>`
    return html`<div class="wrap" style="text-align:${d.align ?? 'left'}">${el}</div>`
  }

  private _nav() {
    this.fire(SF_EVENTS.selectPromotion, this.data.action?.params)
  }

  private _act() {
    const a = this.data.action
    if (!a || a.kind === 'none') return
    this.fire(a.kind, a.params)
  }
}

export const buttonType: BlockType = {
  type: 'button',
  name: '按鈕',
  tag: 'sf-button',
  schema: {
    fields: [
      { key: 'text', label: '文字', type: 'text' },
      { key: 'action', label: '動作', type: 'action' },
      {
        key: 'variant',
        label: '樣式',
        type: 'select',
        options: [
          { label: '實心', value: 'primary' },
          { label: '外框', value: 'outline' },
        ],
      },
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
    ],
  },
  defaults: {
    text: '立即選購',
    action: { kind: 'begin_checkout' },
    variant: 'primary',
    align: 'left',
  },
}

declare global {
  interface HTMLElementTagNameMap {
    'sf-button': SfButton
  }
}
