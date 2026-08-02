import { css, html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../register-element'
import type { BlockAction, BlockType } from '../contract'
import { actionHref } from '../contract'
import { SfBlockElement } from '../block-element'
import { SF_EVENTS } from '../events'
import { resetStyles } from '../reset'
import { ICON_LABELS, ICON_NAMES, renderIcon } from '../icons'
import type { IconName } from '../icons'

export interface IconData {
  name?: IconName
  size?: number
  color?: string
  badge?: string
  action?: BlockAction
}

@customElement('sf-icon')
export class SfIcon extends SfBlockElement {
  protected blockType = 'icon'

  @property({ type: Object }) data: IconData = {}

  static styles = css`
    ${resetStyles}
    :host { display: inline-block; }
    a, button {
      display: inline-flex; align-items: center; justify-content: center;
      position: relative; color: inherit; background: none; border: none;
      padding: 6px; cursor: pointer; line-height: 0;
    }
    .badge {
      position: absolute; top: 0; right: 0;
      min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box;
      border-radius: 8px; background: #ff4d4f; color: #fff;
      font-size: 11px; line-height: 16px; text-align: center; font-family: sans-serif;
    }
  `

  render() {
    const d = this.data
    const size = d.size ?? 24
    const color = d.color ?? '#333333'
    const icon = renderIcon(d.name ?? 'star', size, 1.75)
    const badge = d.badge ? html`<span class="badge">${d.badge}</span>` : null
    const href = actionHref(d.action)
    // 純導航 → <a href>(SEO);行為型(開購物車/登入…)→ <button> 發事件。
    return href
      ? html`<a href=${href} style="color:${color}" @click=${this._nav}>${icon}${badge}</a>`
      : html`<button type="button" style="color:${color}" @click=${this._act}>${icon}${badge}</button>`
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

export const iconType: BlockType = {
  type: 'icon',
  name: '圖示',
  tag: 'sf-icon',
  schema: {
    fields: [
      { key: 'name', label: '圖示', type: 'select', options: ICON_NAMES.map((n) => ({ label: ICON_LABELS[n], value: n })) },
      { key: 'size', label: '大小', type: 'number', min: 12, max: 64, step: 1 },
      { key: 'color', label: '顏色', type: 'color' },
      { key: 'badge', label: '角標(數字/文字)', type: 'text', placeholder: '例:3' },
      { key: 'action', label: '動作', type: 'action' },
    ],
  },
  defaults: { name: 'cart', size: 24, color: '#333333', action: { kind: 'view_cart' } },
}

declare global {
  interface HTMLElementTagNameMap {
    'sf-icon': SfIcon
  }
}
