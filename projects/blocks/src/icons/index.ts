import { html } from 'lit'
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'
import type { TemplateResult } from 'lit'
import type { IconName } from './paths'
import { PATHS } from './paths'

export type { IconName } from './paths'
export { ICON_NAMES, ICON_LABELS } from './paths'

export function renderIcon(name: IconName, size = 24, stroke = 1.75): TemplateResult {
  const path = PATHS[name] ?? PATHS.star
  return html`<svg
    viewBox="0 0 24 24"
    width=${size}
    height=${size}
    fill="none"
    stroke="currentColor"
    stroke-width=${stroke}
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    ${unsafeSVG(path)}
  </svg>`
}
