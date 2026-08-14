import { css, html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../../core/register-element'
import type { BlockType, MaybePerDevice, Spacing } from '../../contract'
import { genDeviceVars, toSpacing } from '../../contract'
import { SfBlockElement } from '../../core/block-element'
import { resetStyles } from '../../styles/reset'
import { mobileQuery } from '../../styles/device'

export interface StackData {
  /** 背景色不分裝置 —— 品牌樣式兩邊不一致是 bug。 */
  bgColor?: string
  minHeight?: MaybePerDevice<number>
  padding?: MaybePerDevice<number | Spacing>
}

// 疊層:純堆疊容器。子區塊「同格」疊放,**自然順序決定上下(後者在上),不管 z-index**。
// 背景圖 / 遮罩不歸疊層管——把圖片積木當底層子區塊(圖片自己管遮罩)。
// 各子區塊在疊層中的定位,由「子區塊自己的 9 宮格」決定(編輯器裡設)。
@customElement('sf-stack')
export class SfStack extends SfBlockElement {
  protected blockType = 'stack'

  @property({ type: Object }) data: StackData = {}

  static styles = css`
    ${resetStyles}
    :host {
      display: block;
    }
    /* overflow:hidden:疊層是堆疊/hero 容器,子區塊(如背景圖)超出邊界要裁掉,不外溢蓋到頁首/頁尾 */
    .stack {
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
      min-height: var(--sf-min-h);
      padding: var(--sf-pad);
    }
    ${mobileQuery} {
      .stack {
        min-height: var(--sf-min-h-m, var(--sf-min-h));
        padding: var(--sf-pad-m, var(--sf-pad));
      }
    }
    ::slotted(*) {
      position: absolute;
    }
  `

  render() {
    const d = this.data
    const vars = genDeviceVars(d, (dd) => {
      const pad = toSpacing(dd.padding, 0)
      return {
        'min-h': `${dd.minHeight ?? 320}px`,
        pad: `${pad.y}px ${pad.x}px`,
      }
    })
    const style = [vars, d.bgColor ? `background:${d.bgColor}` : ''].filter(Boolean).join(';')
    return html`<div class="stack" style=${style}><slot></slot></div>`
  }
}

export const stackType: BlockType = {
  type: 'stack',
  name: '疊層',
  tag: 'sf-stack',
  container: true,
  schema: {
    fields: [
      {
        key: 'minHeight',
        label: '高度',
        type: 'number',
        min: 80,
        max: 800,
        step: 20,
        perDevice: true,
      },
      {
        key: 'padding',
        label: '內距 X/Y',
        type: 'spacing',
        min: 0,
        max: 120,
        step: 4,
        perDevice: true,
      },
      { key: 'bgColor', label: '背景色', type: 'color' },
    ],
  },
  defaults: { minHeight: 320, padding: 0 },
}

declare global {
  interface HTMLElementTagNameMap {
    'sf-stack': SfStack
  }
}
