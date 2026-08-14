import { unsafeCSS } from 'lit'
import { MOBILE_BREAKPOINT, VIEWPORT_CONTAINER } from '../contract/per-device'

// 手機那段的 at-rule 前綴,給各區塊的 `static styles` 用:
//
//   static styles = css`
//     .c { gap: var(--sf-gap); }
//     ${mobileQuery} { .c { gap: var(--sf-gap-m, var(--sf-gap)); } }
//   `
//
// 斷點與容器名只定義在 contract/per-device.ts 一處。
export const mobileQuery = unsafeCSS(
  `@container ${VIEWPORT_CONTAINER} (max-width:${MOBILE_BREAKPOINT}px)`,
)
