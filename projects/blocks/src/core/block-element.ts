import { LitElement } from 'lit'
import { SF_EVENTS, emitEvent } from '../events'

// 區塊基底:所有區塊繼承它,自動走 event-routing 發「觀察型」事件——
// 曝光(進視窗一次,view_promotion)、hover(首次滑入,block_hover)。
// 命令型事件由子類在互動時用 this.fire(...) 發。
export abstract class SfBlockElement extends LitElement {
  /** 區塊型別名,子類覆寫,作為事件 source。 */
  protected abstract blockType: string

  private _io?: IntersectionObserver
  private _impressed = false
  private _hovered = false

  connectedCallback(): void {
    super.connectedCallback()
    if ('IntersectionObserver' in globalThis) {
      this._io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting && !this._impressed) {
              this._impressed = true
              this.fire(SF_EVENTS.viewPromotion)
            }
          }
        },
        { threshold: 0.5 },
      )
      this._io.observe(this)
    }
    this.addEventListener('pointerenter', this._onHover)
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this._io?.disconnect()
    this.removeEventListener('pointerenter', this._onHover)
  }

  // hover 是弱訊號:只記首次滑入,避免噪音。
  private _onHover = (): void => {
    if (this._hovered) return
    this._hovered = true
    this.fire(SF_EVENTS.blockHover)
  }

  protected fire(name: string, params?: Record<string, unknown>): void {
    emitEvent(this, { name, params, source: this.blockType })
  }
}
