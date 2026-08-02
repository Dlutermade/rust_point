import type { BlockType } from './contract'
// 具名匯入即載入模組 → @customElement 自動註冊自訂元素。
import { containerType } from './blocks/container'
import { stackType } from './blocks/stack'
import { headingType } from './blocks/heading'
import { textType } from './blocks/text'
import { buttonType } from './blocks/button'
import { imageType } from './blocks/image'
import { spacerType } from './blocks/spacer'
import { dividerType } from './blocks/divider'
import { iconType } from './blocks/icon'

// 版面 / 疊層是組合原語;banner / header / footer 都用它們自己組。
export const blockTypes: BlockType[] = [
  containerType,
  stackType,
  headingType,
  textType,
  buttonType,
  imageType,
  iconType,
  spacerType,
  dividerType,
]

export const blockTypeMap: Record<string, BlockType> = Object.fromEntries(
  blockTypes.map((b) => [b.type, b]),
)
