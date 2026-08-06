import type { BlockType } from '../contract'
// 具名匯入即載入模組 → @customElement 自動註冊自訂元素。
import { containerType } from '../blocks/layout/container'
import { stackType } from '../blocks/layout/stack'
import { headingType } from '../blocks/content/heading'
import { textType } from '../blocks/content/text'
import { buttonType } from '../blocks/content/button'
import { imageType } from '../blocks/content/image'
import { iconType } from '../blocks/content/icon'
import { spacerType } from '../blocks/separator/spacer'
import { dividerType } from '../blocks/separator/divider'

// 容器 / 疊層是組合原語;banner / header / footer 都用它們自己組。
// 順序 = 編輯器區塊面板的排列順序。
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
