import { css, html } from 'lit'
import { property } from 'lit/decorators.js'
import { customElement } from '../../core/register-element'
import type { BlockType, Spacing } from '../../contract'
import { toSpacing } from '../../contract'
import { SfBlockElement } from '../../core/block-element'
import { resetStyles } from '../../styles/reset'

export interface ContainerData {
  direction?: 'row' | 'column'
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around'
  align?: 'stretch' | 'flex-start' | 'center' | 'flex-end'
  wrap?: boolean
  gap?: number | Spacing
  padding?: number | Spacing
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

// 彈性版面(auto-layout):方向可水平可垂直 + 主軸/交叉軸對齊 + X/Y 間距/內距。
// 加了圓角/陰影/邊框 → 任何版面都能當「卡片」。
@customElement('sf-container')
export class SfContainer extends SfBlockElement {
  protected blockType = 'container'

  @property({ type: Object }) data: ContainerData = {}

  static styles = css`
    ${resetStyles}
    :host {
      display: block;
    }
    .c {
      display: flex;
      box-sizing: border-box;
    }
    ::slotted(*) {
      min-width: 0;
    }
  `

  render() {
    const d = this.data
    const gap = toSpacing(d.gap, 16)
    const pad = toSpacing(d.padding, 16)
    const s = SHADOWS[d.shadow ?? 'md']
    const shadow = d.shadowOn
      ? `0 ${s.y}px ${s.blur}px ${shadowRgba(d.shadowColor ?? '#000000', s.a)}`
      : ''
    const border = d.borderOn
      ? `border:${d.borderWidth ?? 1}px solid ${d.borderColor ?? '#e5e5e5'}`
      : ''
    const style = [
      `flex-direction:${d.direction ?? 'column'}`,
      `justify-content:${d.justify ?? 'flex-start'}`,
      `align-items:${d.align ?? 'stretch'}`,
      `flex-wrap:${d.wrap ? 'wrap' : 'nowrap'}`,
      `column-gap:${gap.x}px`,
      `row-gap:${gap.y}px`,
      `padding:${pad.y}px ${pad.x}px`,
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
  name: '版面 Flex',
  tag: 'sf-container',
  container: true,
  schema: {
    fields: [
      {
        key: 'direction',
        label: '方向',
        type: 'select',
        options: [
          { label: '水平 →', value: 'row' },
          { label: '垂直 ↓', value: 'column' },
        ],
      },
      {
        key: 'justify',
        label: '主軸對齊',
        type: 'select',
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
        options: [
          { label: '拉伸', value: 'stretch' },
          { label: '起', value: 'flex-start' },
          { label: '置中', value: 'center' },
          { label: '末', value: 'flex-end' },
        ],
      },
      { key: 'wrap', label: '自動換行', type: 'boolean' },
      { key: 'gap', label: '間距 X/Y', type: 'spacing', min: 0, max: 120, step: 2 },
      { key: 'padding', label: '內距 X/Y', type: 'spacing', min: 0, max: 120, step: 2 },
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
