import { css, html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../../core/register-element'
import type { BlockAction, BlockType, MaybePerDevice } from '../../contract'
import { actionHref, atDevice, genDeviceVars } from '../../contract'
import { SfBlockElement } from '../../core/block-element'
import { SF_EVENTS } from '../../events'
import { resetStyles } from '../../styles/reset'
import { mobileQuery } from '../../styles/device'
import { ICON_LABELS, ICON_NAMES, renderIcon } from '../../icons'
import type { IconName } from '../../icons'

export interface IconData {
  name?: IconName
  size?: MaybePerDevice<number>
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
    :host {
      display: inline-block;
    }
    a,
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      position: relative;
      color: inherit;
      background: none;
      border: none;
      padding: 6px;
      cursor: pointer;
      line-height: 0;
    }
    /* 覆蓋 renderIcon 寫在 SVG 上的 width/height —— CSS 優先於 presentation attribute,
       所以尺寸能分裝置,而 SVG 屬性仍是無 CSS 時(SSR 首幀)的合理預設。 */
    svg {
      width: var(--sf-size);
      height: var(--sf-size);
    }
    ${mobileQuery} {
      svg {
        width: var(--sf-size-m, var(--sf-size));
        height: var(--sf-size-m, var(--sf-size));
      }
    }
    .badge {
      position: absolute;
      top: 0;
      right: 0;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      box-sizing: border-box;
      border-radius: 8px;
      background: #ff4d4f;
      color: #fff;
      font-size: 11px;
      line-height: 16px;
      text-align: center;
      font-family: sans-serif;
    }
  `

  render() {
    const d = this.data
    const color = d.color ?? '#333333'
    const vars = genDeviceVars(d, (dd) => ({ size: `${dd.size ?? 24}px` }))
    // 傳電腦值給 SVG 屬性當無 CSS 時的預設;實際尺寸由上方的變數決定。
    const icon = renderIcon(d.name ?? 'star', atDevice(d.size, 'desktop') ?? 24, 1.75)
    const badge = d.badge ? html`<span class="badge">${d.badge}</span>` : null
    const href = actionHref(d.action)
    const style = `color:${color};${vars}`
    return href
      ? html`<a href=${href} style=${style} @click=${this._nav}>${icon}${badge}</a>`
      : html`<button type="button" style=${style} @click=${this._act}>${icon}${badge}</button>`
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
      {
        key: 'name',
        label: '圖示',
        type: 'select',
        options: ICON_NAMES.map((n) => ({ label: ICON_LABELS[n], value: n })),
      },
      { key: 'size', label: '大小', type: 'number', min: 12, max: 64, step: 1, perDevice: true },
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
