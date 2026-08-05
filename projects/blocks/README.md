# @sc/blocks — 區塊庫

前台中心的區塊型別系統:一組 Lit Web Components,加上編輯器與渲染共用的**契約**。規格見 [`docs/plan/02-storefront-center/`](../../docs/plan/02-storefront-center/)(對應里程碑 M3)。

一包兩用:編輯器([`../admin/`](../admin/))吃它的 schema 生設定表單、掛自訂元素做即時預覽;前台之後載同一包做互動。

## 區塊型別

版面 / 疊層是組合原語 —— banner、header、footer 都用這些自己組,不做成獨立型別。

| 型別 | 用途 |
|------|------|
| `container` / `stack` | 版面與疊層(可容納子區塊) |
| `heading` / `text` | 文字 |
| `button` / `icon` | 互動與圖示 |
| `image` | 圖片 |
| `spacer` / `divider` | 留白與分隔 |

## 契約

- [`contract.ts`](src/contract.ts) — `BlockType`(型別 id + 自訂元素標籤 + schema + 預設值)、`BlockField`(表單欄位型別、條件顯示)、`BlockAction`(動作**意圖**,不是行為)。
  純導航(有 URL)渲染成真正的 `<a href>`(SEO 可爬、支援新分頁);其他行為渲染成 `<button>` 發事件 —— 這是 SEO 的關鍵區別。
- [`events.ts`](src/events.ts) — 統一事件路由脊椎。區塊發語義事件(命名仿 GA4),宿主裝**一個** router:`execute`(命令 → 行為)+ `sinks`(觀察 → 追蹤 fan-out)。動作與行為解耦,所以「加入購物車」能彈 mini-cart 而不是導頁。
- [`block-element.ts`](src/block-element.ts) — 區塊基底。繼承即自動發觀察型事件:曝光(進視窗一次)、hover(首次滑入)。
- [`registry.ts`](src/registry.ts) — 型別註冊表;具名匯入即載入模組 → `@customElement` 自動註冊。

## 開發

```bash
pnpm install    # 在 repo root 跑(pnpm workspace)
pnpm build      # tsc && vite build → dist/(admin 透過 dist/ 解析本套件)
pnpm dev        # vite dev server,index.html 是區塊 demo 頁
```
