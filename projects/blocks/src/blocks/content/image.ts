import { css, html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../../core/register-element'
import type { BlockAction, BlockType } from '../../contract'
import { actionHref } from '../../contract'
import { SfBlockElement } from '../../core/block-element'
import { SF_EVENTS } from '../../events'
import { resetStyles } from '../../styles/reset'

export interface ImageData {
  src?: string
  alt?: string
  fit?: 'cover' | 'contain'
  overlay?: number // 暗色遮罩 % 0-70(圖片自己管,疊在圖上讓上層文字好讀)
  action?: BlockAction
}

@customElement('sf-image')
export class SfImage extends SfBlockElement {
  protected blockType = 'image'

  @property({ type: Object }) data: ImageData = {}

  static styles = css`
    ${resetStyles}
    :host {
      display: block;
    }
    .wrap {
      position: relative;
      width: 100%;
      height: 100%;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
    }
    .scrim {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .link {
      display: block;
      width: 100%;
      height: 100%;
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
    }
  `

  render() {
    const d = this.data
    const src = d.src || 'https://picsum.photos/seed/sf-image/800/520'
    const fit = d.fit ?? 'cover'
    const ov = d.overlay ?? 0
    const media = html`<div class="wrap">
      <img src="${src}" alt="${d.alt ?? ''}" style="object-fit:${fit}" />
      ${ov > 0 ? html`<div class="scrim" style="background:rgba(0,0,0,${ov / 100})"></div>` : null}
    </div>`

    const href = actionHref(d.action)
    if (href) {
      return html`<a class="link" href="${href}" @click=${this._onNavClick}>${media}</a>`
    }
    const behavioral = d.action && d.action.kind !== 'none'
    return behavioral
      ? html`<button class="link" type="button" @click=${this._onClick}>${media}</button>`
      : media
  }

  private _onNavClick() {
    this.fire(SF_EVENTS.selectPromotion, this.data.action?.params)
  }

  private _onClick() {
    const a = this.data.action
    if (!a || a.kind === 'none') return
    this.fire(a.kind, a.params)
  }
}

export const imageType: BlockType = {
  type: 'image',
  name: '圖片',
  tag: 'sf-image',
  schema: {
    fields: [
      { key: 'src', label: '圖片', type: 'image' },
      { key: 'alt', label: '替代文字', type: 'text' },
      {
        key: 'fit',
        label: '裁切',
        type: 'select',
        options: [
          { label: '填滿裁切 cover', value: 'cover' },
          { label: '完整顯示 contain', value: 'contain' },
        ],
      },
      { key: 'overlay', label: '遮罩(暗)', type: 'number', min: 0, max: 70, step: 5 },
      { key: 'action', label: '點擊動作', type: 'action' },
    ],
  },
  defaults: {
    alt: '',
    fit: 'cover',
    action: { kind: 'none' },
  },
}

declare global {
  interface HTMLElementTagNameMap {
    'sf-image': SfImage
  }
}
