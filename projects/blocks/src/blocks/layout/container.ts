import { css, html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../../core/register-element'
import type { BlockType, MaybePerDevice, Spacing } from '../../contract'
import { genDeviceVars, toSpacing } from '../../contract'
import { SfBlockElement } from '../../core/block-element'
import { resetStyles } from '../../styles/reset'
import { mobileQuery } from '../../styles/device'

// 排法類欄位可分裝置(電腦 / 手機各存一份),品牌樣式類不分 ——
// 顏色 / 圓角 / 邊框 / 陰影兩個裝置不一致是 bug 不是功能。
export interface ContainerData {
  direction?: MaybePerDevice<'row' | 'column'>
  justify?: MaybePerDevice<'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around'>
  align?: MaybePerDevice<'stretch' | 'flex-start' | 'center' | 'flex-end'>
  wrap?: MaybePerDevice<boolean>
  gap?: MaybePerDevice<number | Spacing>
  padding?: MaybePerDevice<number | Spacing>
  background?: string
  radius?: number
  shadowOn?: boolean
  shadow?: 'sm' | 'md' | 'lg'
  shadowColor?: string
  borderOn?: boolean
  borderColor?: string
  borderWidth?: number
}

// 強度決定位移/模糊/不透明度;顏色由 shadowColor 帶入。
const SHADOWS: Record<string, { y: number; blur: number; a: number }> = {
  sm: { y: 1, blur: 3, a: 0.12 },
  md: { y: 4, blur: 14, a: 0.14 },
  lg: { y: 12, blur: 32, a: 0.18 },
}

function shadowRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const n =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const r = Number.parseInt(n.slice(0, 2), 16) || 0
  const g = Number.parseInt(n.slice(2, 4), 16) || 0
  const b = Number.parseInt(n.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${alpha})`
}

// 容器(auto-layout):方向可水平可垂直 + 主軸/交叉軸對齊 + X/Y 間距/內距。
// 加了圓角/陰影/邊框 → 任何容器都能當「卡片」。
@customElement('sf-container')
export class SfContainer extends SfBlockElement {
  protected blockType = 'container'

  @property({ type: Object }) data: ContainerData = {}

  // 排法走 CSS 變數 + container query:電腦值寫 --sf-x,手機值只有在不同時才寫 --sf-x-m,
  // 手機那段用 var(--sf-x-m, var(--sf-x)) 自動沿用 → 不分裝置的容器不會多出任何位元組。
  static styles = css`
    ${resetStyles}
    :host {
      display: block;
    }
    .c {
      display: flex;
      box-sizing: border-box;
      flex-direction: var(--sf-dir);
      justify-content: var(--sf-justify);
      align-items: var(--sf-align);
      flex-wrap: var(--sf-wrap);
      column-gap: var(--sf-gap-x);
      row-gap: var(--sf-gap-y);
      padding: var(--sf-pad);
    }
    ${mobileQuery} {
      .c {
        flex-direction: var(--sf-dir-m, var(--sf-dir));
        justify-content: var(--sf-justify-m, var(--sf-justify));
        align-items: var(--sf-align-m, var(--sf-align));
        flex-wrap: var(--sf-wrap-m, var(--sf-wrap));
        column-gap: var(--sf-gap-x-m, var(--sf-gap-x));
        row-gap: var(--sf-gap-y-m, var(--sf-gap-y));
        padding: var(--sf-pad-m, var(--sf-pad));
      }
    }
    ::slotted(*) {
      min-width: 0;
    }
  `

  render() {
    const d = this.data
    // 分裝置的排法欄位 → CSS 變數(兩份)
    const vars = genDeviceVars(d, (dd) => {
      const gap = toSpacing(dd.gap, 16)
      const pad = toSpacing(dd.padding, 16)
      return {
        dir: dd.direction ?? 'column',
        justify: dd.justify ?? 'flex-start',
        align: dd.align ?? 'stretch',
        wrap: dd.wrap ? 'wrap' : 'nowrap',
        'gap-x': `${gap.x}px`,
        'gap-y': `${gap.y}px`,
        pad: `${pad.y}px ${pad.x}px`,
      }
    })
    // 不分裝置的品牌樣式 → 照舊直接寫
    const s = SHADOWS[d.shadow ?? 'md']
    const shadow = d.shadowOn
      ? `0 ${s.y}px ${s.blur}px ${shadowRgba(d.shadowColor ?? '#000000', s.a)}`
      : ''
    const border = d.borderOn
      ? `border:${d.borderWidth ?? 1}px solid ${d.borderColor ?? '#e5e5e5'}`
      : ''
    const style = [
      vars,
      d.background ? `background:${d.background}` : '',
      d.radius ? `border-radius:${d.radius}px` : '',
      d.radius ? 'overflow:hidden' : '',
      shadow ? `box-shadow:${shadow}` : '',
      border,
    ]
      .filter(Boolean)
      .join(';')
    return html`<div class="c" style=${style}><slot></slot></div>`
  }
}

export const containerType: BlockType = {
  type: 'container',
  name: '容器',
  tag: 'sf-container',
  container: true,
  schema: {
    fields: [
      // 排法類:可分裝置。direction 是其中最關鍵的一個 ——
      // 電腦 row、手機 column,「三欄變一欄」就是靠它。
      {
        key: 'direction',
        label: '方向',
        type: 'select',
        perDevice: true,
        options: [
          { label: '水平 →', value: 'row' },
          { label: '垂直 ↓', value: 'column' },
        ],
      },
      {
        key: 'justify',
        label: '主軸對齊',
        type: 'select',
        perDevice: true,
        options: [
          { label: '起', value: 'flex-start' },
          { label: '置中', value: 'center' },
          { label: '末', value: 'flex-end' },
          { label: '兩端對齊', value: 'space-between' },
          { label: '平均分佈', value: 'space-around' },
        ],
      },
      {
        key: 'align',
        label: '交叉軸對齊',
        type: 'select',
        perDevice: true,
        options: [
          { label: '拉伸', value: 'stretch' },
          { label: '起', value: 'flex-start' },
          { label: '置中', value: 'center' },
          { label: '末', value: 'flex-end' },
        ],
      },
      { key: 'wrap', label: '自動換行', type: 'boolean', perDevice: true },
      {
        key: 'gap',
        label: '間距 X/Y',
        type: 'spacing',
        min: 0,
        max: 120,
        step: 2,
        perDevice: true,
      },
      {
        key: 'padding',
        label: '內距 X/Y',
        type: 'spacing',
        min: 0,
        max: 120,
        step: 2,
        perDevice: true,
      },
      // 以下是品牌樣式,不分裝置 —— 兩個裝置顏色 / 圓角不一致是 bug 不是功能。
      { key: 'background', label: '背景色', type: 'color' },
      { key: 'radius', label: '圓角', type: 'number', min: 0, max: 40, step: 2 },
      { key: 'borderOn', label: '邊框', type: 'boolean' },
      { key: 'borderColor', label: '邊框顏色', type: 'color', showIf: { key: 'borderOn' } },
      {
        key: 'borderWidth',
        label: '邊框粗細',
        type: 'number',
        min: 1,
        max: 8,
        step: 1,
        showIf: { key: 'borderOn' },
      },
      { key: 'shadowOn', label: '陰影', type: 'boolean' },
      {
        key: 'shadow',
        label: '陰影強度',
        type: 'select',
        showIf: { key: 'shadowOn' },
        options: [
          { label: '小', value: 'sm' },
          { label: '中', value: 'md' },
          { label: '大', value: 'lg' },
        ],
      },
      { key: 'shadowColor', label: '陰影顏色', type: 'color', showIf: { key: 'shadowOn' } },
    ],
  },
  defaults: {
    direction: 'column',
    justify: 'flex-start',
    align: 'stretch',
    wrap: false,
    gap: 16,
    padding: 16,
  },
}

declare global {
  interface HTMLElementTagNameMap {
    'sf-container': SfContainer
  }
}
