import type { SfEvent } from './event'
import type { SfContext } from './context'
import { getContext } from './context'

export interface SfEventEnvelope {
  event: SfEvent
  context: Readonly<SfContext>
}

export const SF_EVENT = 'sf-event'

// composed 讓事件穿出 Shadow DOM,冒泡到宿主根。
export function emitEvent(el: HTMLElement, event: SfEvent): void {
  el.dispatchEvent(
    new CustomEvent<SfEvent>(SF_EVENT, {
      detail: event,
      bubbles: true,
      composed: true,
    }),
  )
}

// sink:一個追蹤目的地(自家 collector / GA4 / Meta / 編輯器 console)。可插拔、可多個。
export type SfSink = (envelope: SfEventEnvelope) => void

export interface EventRouter {
  /** 命令型事件 → 執行行為(導頁 / 彈 mini-cart …)。純觀察事件不動它。 */
  execute?: (event: SfEvent, context: Readonly<SfContext>) => void
  /** 追蹤目的地,所有事件都 fan-out;各自批次/上報、不擋互動。 */
  sinks?: SfSink[]
}

// 宿主(前台 runtime / 編輯器)裝一個路由,回傳解除函式。
export function installEventRouter(target: EventTarget, router: EventRouter): () => void {
  const handler = (ev: Event) => {
    const event = (ev as CustomEvent<SfEvent>).detail
    const context = getContext()
    router.execute?.(event, context)
    if (router.sinks && router.sinks.length > 0) {
      const envelope: SfEventEnvelope = { event, context }
      for (const sink of router.sinks) sink(envelope)
    }
  }
  target.addEventListener(SF_EVENT, handler)
  return () => target.removeEventListener(SF_EVENT, handler)
}

// 編輯器用的 sink:印出來、不真上報,用來看事件有沒有正確發。
export const consoleSink: SfSink = ({ event, context }) => {
  console.debug('[sf-track]', event.name, event.params ?? {}, context)
}
