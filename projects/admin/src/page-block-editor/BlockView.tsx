import { createElement, memo, useCallback, useLayoutEffect, useRef } from 'react'
import { blockTypeMap } from '@sc/blocks'
import type { BlockInstance, BlockSize, Pos9 } from '../api/types'

type Axis = 'flow' | 'row' | 'column' | 'stack'

const POS_SELF: Record<string, [string, string]> = {
  'top-left': ['start', 'start'],
  top: ['start', 'center'],
  'top-right': ['start', 'end'],
  left: ['center', 'start'],
  center: ['center', 'center'],
  right: ['center', 'end'],
  'bottom-left': ['end', 'start'],
  bottom: ['end', 'center'],
  'bottom-right': ['end', 'end'],
}

function axisCss(
  mode: string,
  px: number | undefined,
  role: 'main' | 'cross',
  prop: 'width' | 'height',
): string {
  if (role === 'main') {
    if (mode === 'fill') return 'flex:1 1 0;min-width:0;min-height:0'
    if (mode === 'fixed') return `flex:0 0 ${px ?? 100}px`
    return 'flex:0 0 auto'
  }
  if (mode === 'fill') return 'align-self:stretch'
  if (mode === 'fixed') return `align-self:flex-start;${prop}:${px ?? 100}px`
  return 'align-self:flex-start'
}

// 疊層(abs+rel):子區塊絕對定位,填滿→inset:0;貼齊/固定→依 9 宮格算 top/left。
function stackCss(size: BlockSize, pos: Pos9 | undefined): string {
  const [av, ah] = POS_SELF[pos ?? 'center'] ?? ['center', 'center']
  const w = size.w ?? 'hug'
  const h = size.h ?? 'hug'
  const p: string[] = ['position:absolute']

  if (w === 'fill') p.push('left:0', 'right:0')
  else {
    p.push(w === 'fixed' ? `width:${size.wPx ?? 100}px` : 'width:max-content')
    if (ah === 'start') p.push('left:0')
    else if (ah === 'end') p.push('right:0')
    else p.push('left:50%')
  }
  if (h === 'fill') p.push('top:0', 'bottom:0')
  else {
    p.push(h === 'fixed' ? `height:${size.hPx ?? 100}px` : 'height:max-content')
    if (av === 'start') p.push('top:0')
    else if (av === 'end') p.push('bottom:0')
    else p.push('top:50%')
  }
  const xC = w !== 'fill' && ah === 'center'
  const yC = h !== 'fill' && av === 'center'
  if (xC && yC) p.push('transform:translate(-50%,-50%)')
  else if (xC) p.push('transform:translateX(-50%)')
  else if (yC) p.push('transform:translateY(-50%)')
  return p.join(';')
}

function sizeStyle(size: BlockSize | undefined, pos: Pos9 | undefined, parentAxis: Axis): string {
  const s = size ?? {}
  if (parentAxis === 'stack') return stackCss(s, pos)
  const h = s.h ?? 'hug'
  if (parentAxis === 'row' || parentAxis === 'column') {
    return [
      axisCss(
        s.w ?? (parentAxis === 'row' ? 'hug' : 'fill'),
        s.wPx,
        parentAxis === 'row' ? 'main' : 'cross',
        'width',
      ),
      axisCss(h, s.hPx, parentAxis === 'row' ? 'cross' : 'main', 'height'),
    ].join(';')
  }
  const w = s.w ?? 'fill'
  return [
    w === 'fixed' ? `width:${s.wPx ?? 100}px` : w === 'fill' ? 'width:100%' : 'width:fit-content',
    h === 'fixed' ? `height:${s.hPx ?? 100}px` : 'height:auto',
  ].join(';')
}

// 選取/落點框改用畫布的動態 CSS(靠 data-block-id 命中),不再傳 props 到每顆 → memo 生效。
function BlockViewInner({
  instance,
  parentAxis = 'flow',
}: {
  instance: BlockInstance
  parentAxis?: Axis
}) {
  const nodeRef = useRef<(HTMLElement & { data?: unknown }) | null>(null)
  // 最新的 instance/parentAxis 給 callback ref 用(避免 ref 每次 render 換身分)。
  const instRef = useRef(instance)
  instRef.current = instance
  const axisRef = useRef(parentAxis)
  axisRef.current = parentAxis

  // 把 data(property,非 attribute)+ 版面 style 塞進 WC。
  const apply = (el: (HTMLElement & { data?: unknown }) | null) => {
    if (!el) return
    const inst = instRef.current
    el.data = inst.data
    // 明確告知父層軸(分割線的「自動」方向靠這個;其餘區塊忽略)。
    el.setAttribute('parent-axis', axisRef.current)
    el.setAttribute('style', sizeStyle(inst.size, inst.pos, axisRef.current))
  }
  // 穩定的 callback ref:元素一掛上(含 remount 到新父層)就「同步」塞 data,
  // 不等 useEffect,避免新元素先以預設 data render 一幀(容器會閃/卡成垂直)。
  const setNode = useCallback((el: (HTMLElement & { data?: unknown }) | null) => {
    nodeRef.current = el
    apply(el)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // instance 更新時重塞(同一元素、非 remount);remount 由上面的 callback ref 同步處理。
  useLayoutEffect(() => {
    apply(nodeRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.data, instance.size, instance.pos, parentAxis])

  const bt = blockTypeMap[instance.type]
  if (!bt) return null

  const attrs: Record<string, unknown> = { ref: setNode, 'data-block-id': instance.id }
  if (bt.container) attrs['data-container'] = ''

  const childAxis: Axis =
    instance.type === 'stack'
      ? 'stack'
      : bt.container
        ? ((instance.data.direction as 'row' | 'column') ?? 'column')
        : 'flow'

  const children = instance.children?.map((c) => (
    <BlockView key={c.id} instance={c} parentAxis={childAxis} />
  ))

  return createElement(bt.tag, attrs, children)
}

export const BlockView = memo(BlockViewInner)
