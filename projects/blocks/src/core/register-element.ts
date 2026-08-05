import { customElement as litCustomElement } from 'lit/decorators.js'

// 冪等註冊:元素若已在 registry 裡就跳過(回傳 no-op decorator),
// 避免「重複匯入 / HMR / 同一包被載兩次」時 CustomElementRegistry 丟
// "the name 'sf-xxx' has already been used" 而整個崩潰。
// 代價:HMR 時沿用先前註冊的類別,要看到改動需整頁重載 —— 但不會炸。
export function customElement(name: string): any {
  const decorator = litCustomElement(name)
  return (target: any, context?: any) => {
    if (customElements.get(name)) return target
    return (decorator as any)(target, context)
  }
}
