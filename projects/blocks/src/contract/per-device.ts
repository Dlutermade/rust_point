// 分裝置設定值:電腦與手機各存一份。
//
// **怎麼切換裝置**:用 CSS container query,不用 JS 判斷。
// 理由是前台 SSR —— container query 讓一份 HTML 兩個裝置共用,
// 快取鍵不必加裝置維度;JS 判斷則要為每個裝置各產一份 HTML。
//
// **為什麼是 container 而不是 media query**:編輯器的預覽畫布是一個固定寬度的
// `<div>`(手機 390 / 電腦 1180),不是 iframe。media query 看的是瀏覽器 viewport,
// 切到「手機」時 viewport 根本沒變,查詢不會觸發。container query 看的是容器寬度,
// 改畫布寬度就生效。
//
// **為什麼用 CSS 變數**:Lit 不支援在 `<style>` 元素內插值,所以 `@container` 區塊
// 只能寫在靜態的 `static styles` 裡;隨資料變動的部分就交給 inline 的 CSS 變數。
// 靜態那份還是 constructable stylesheet,所有實例共享。

export type Device = 'desktop' | 'mobile'

export interface PerDevice<T> {
  desktop: T
  mobile: T
}

/** 欄位值:可能分裝置,也可能是裸值(未分裝置的欄位、或還沒被改過的舊資料)。 */
export type MaybePerDevice<T> = T | PerDevice<T>

/** 手機斷點。改這裡就會同時改掉所有區塊的切換點。 */
export const MOBILE_BREAKPOINT = 768

/** 畫布宣告的具名容器。具名是必要的 —— 否則巢狀區塊會去查最近的祖先容器(它的父區塊)而不是畫布。 */
export const VIEWPORT_CONTAINER = 'sf-viewport'

function checkIsPerDevice(v: unknown): v is PerDevice<unknown> {
  return typeof v === 'object' && v !== null && 'desktop' in v && 'mobile' in v
}

/** 取某裝置的值。裸值兩邊都回它自己。 */
export function atDevice<T>(v: MaybePerDevice<T> | undefined, device: Device): T | undefined {
  if (v === undefined) return undefined
  return checkIsPerDevice(v) ? (v[device] as T) : v
}

/**
 * 解開單一欄位:`PerDevice<U>` → `U`,其餘原樣。
 *
 * 刻意獨立成一個 generic 而不是直接寫在下面的 mapped type 裡:
 * conditional type 只有在受檢型別是 **naked type parameter** 時才會對 union 逐項分配。
 * 寫成 `T[K] extends PerDevice<infer U>` 的話 `T[K]` 是 indexed access,不分配,
 * `U | PerDevice<U>` 會被整包判定為「不是 PerDevice」而原封不動。
 */
type Unwrap<V> = V extends PerDevice<infer U> ? U : V

/** 把每個欄位型別裡的 `PerDevice<U>` 解開成 `U` —— 攤平後剛好是欄位本來的值域。 */
export type AtDevice<T> = {
  [K in keyof T]: Unwrap<T[K]>
}

/**
 * 寫入某個裝置的值,另一個裝置維持原樣。
 *
 * 原本是裸值(未分裝置)時先攤成兩份再改其中一邊 —— 所以「只改手機」不會把電腦的值一起改掉。
 */
export function withDevice<T>(
  v: MaybePerDevice<T> | undefined,
  device: Device,
  next: T,
): PerDevice<T> {
  const desktop = atDevice(v, 'desktop') as T
  const mobile = atDevice(v, 'mobile') as T
  return device === 'desktop' ? { desktop: next, mobile } : { desktop, mobile: next }
}

/** 把整份 data 攤平成某個裝置的值,讓區塊的既有邏輯完全不必知道分裝置這件事。 */
export function atDeviceAll<T extends object>(data: T, device: Device): AtDevice<T> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    out[key] = atDevice(value as MaybePerDevice<unknown>, device)
  }
  return out as AtDevice<T>
}

/**
 * 產生 inline 的 CSS 變數宣告。
 *
 * 對每個欄位輸出 `--sf-<key>`(電腦值);只有當手機值不同時,才多輸出 `--sf-<key>-m`。
 * 靜態 CSS 那邊寫 `var(--sf-x-m, var(--sf-x))`,所以沒輸出 `-m` 就自動沿用電腦值 ——
 * 不分裝置的區塊完全不會多出任何位元組。
 *
 * @param data   區塊的 data(欄位值可能分裝置)
 * @param toVars 從「單一裝置的 data」算出這個裝置要用的變數值
 */
export function genDeviceVars<T extends object>(
  data: T,
  toVars: (d: AtDevice<T>) => Record<string, string | undefined>,
): string {
  const desktop = toVars(atDeviceAll(data, 'desktop'))
  const mobile = toVars(atDeviceAll(data, 'mobile'))
  const decls: string[] = []
  for (const [key, value] of Object.entries(desktop)) {
    if (value === undefined) continue
    decls.push(`--sf-${key}:${value}`)
    const m = mobile[key]
    if (m !== undefined && m !== value) decls.push(`--sf-${key}-m:${m}`)
  }
  return decls.join(';')
}
