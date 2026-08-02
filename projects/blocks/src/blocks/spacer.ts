import { css, html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../register-element'
import type { BlockType } from '../contract'
import { SfBlockElement } from '../block-element'

export interface SpacerData {
  height?: number
}

@customElement('sf-spacer')
export class SfSpacer extends SfBlockElement {
  protected blockType = 'spacer'

  @property({ type: Object }) data: SpacerData = {}

  static styles = css`
    :host {
      display: block;
    }
  `

  render() {
    return html`<div style="height:${this.data.height ?? 32}px"></div>`
  }
}

export const spacerType: BlockType = {
  type: 'spacer',
  name: '間距',
  tag: 'sf-spacer',
  schema: {
    fields: [{ key: 'height', label: '高度', type: 'number', min: 0, max: 200, step: 4 }],
  },
  defaults: { height: 32 },
}

declare global {
  interface HTMLElementTagNameMap {
    'sf-spacer': SfSpacer
  }
}
