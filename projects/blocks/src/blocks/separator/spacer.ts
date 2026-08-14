import { css, html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../../core/register-element'
import type { BlockType, MaybePerDevice } from '../../contract'
import { genDeviceVars } from '../../contract'
import { SfBlockElement } from '../../core/block-element'
import { mobileQuery } from '../../styles/device'

export interface SpacerData {
  height?: MaybePerDevice<number>
}

@customElement('sf-spacer')
export class SfSpacer extends SfBlockElement {
  protected blockType = 'spacer'

  @property({ type: Object }) data: SpacerData = {}

  static styles = css`
    :host {
      display: block;
    }
    .sp {
      height: var(--sf-h);
    }
    ${mobileQuery} {
      .sp {
        height: var(--sf-h-m, var(--sf-h));
      }
    }
  `

  render() {
    const vars = genDeviceVars(this.data, (d) => ({ h: `${d.height ?? 32}px` }))
    return html`<div class="sp" style=${vars}></div>`
  }
}

export const spacerType: BlockType = {
  type: 'spacer',
  name: '間距',
  tag: 'sf-spacer',
  schema: {
    fields: [
      { key: 'height', label: '高度', type: 'number', min: 0, max: 200, step: 4, perDevice: true },
    ],
  },
  defaults: { height: 32 },
}

declare global {
  interface HTMLElementTagNameMap {
    'sf-spacer': SfSpacer
  }
}
