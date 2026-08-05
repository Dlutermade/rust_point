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

## 佈局

```
src/
  index.ts                 # 唯一根檔:公開 API(admin 只從套件根 import)
  contract/                # 與 admin 共用的契約
    block-type.ts            # BlockType / BlockField / schema 欄位型別
    action.ts                # BlockAction(動作意圖)+ actionHref
    spacing.ts               # Spacing(X/Y 兩軸)+ toSpacing
  core/                    # 區塊基礎機制
    block-element.ts         # Lit 基底:繼承即自動發曝光 / hover 事件
    register-element.ts      # 冪等 customElement(擋重複註冊崩潰)
    registry.ts              # 型別註冊表 = 編輯器面板順序
  events/                  # 事件路由脊椎
    event.ts                 # SfEvent / SF_EVENTS(GA4 語彙)
    context.ts               # SfContext:SSR 灌一次,併進每顆事件
    router.ts                # emitEvent / installEventRouter / sinks
  blocks/
    layout/                  # container、stack(組合原語,可容納子區塊)
    content/                 # heading、text、image、icon、button
    separator/               # spacer(留白分隔)、divider(線分隔)
  icons/
    paths.ts                 # SVG 路徑 + 中文標籤
    index.ts                 # renderIcon
  styles/reset.ts          # 各區塊 static styles 共吃
  dev/demo.ts              # 只服務 index.html demo,不進公開 API / 型別輸出
```

### 兩個關鍵設計

- **動作是意圖,不是行為** —— `BlockAction.kind` 對齊 GA4 語彙,由宿主 router 的 `execute` 解讀。所以「加入購物車」能彈 mini-cart 而不是導頁,那是 `href` 表達不了的。
- **純導航才用 `<a href>`** —— 有 URL 的動作渲染成真正的錨點(SEO 可爬、支援新分頁 / 中鍵);其他行為渲染成 `<button>` 發事件。這是 SEO 的關鍵區別,判斷收在 [`contract/action.ts`](src/contract/action.ts) 的 `actionHref`。

## 開發

```bash
pnpm install    # 在 repo root 跑(pnpm workspace)
pnpm build      # tsc && vite build → dist/(admin 透過 dist/ 解析本套件)
pnpm dev        # vite dev server,index.html 是區塊 demo 頁
```

lint / format 統一在 repo root(`pnpm lint` / `pnpm format`),一份 oxlint + oxfmt 設定同時管 blocks 與 admin。

⚠️ oxfmt 會格式化 `css` / `html` 模板字串裡的內容。`blocks/content/text.ts` 的內文是 `white-space: pre-wrap`,模板一旦被折行,縮排空白會被原樣渲染成空行 —— 該行必須維持在 printWidth 以內。

新增區塊:在 `blocks/<分類>/` 建檔 → 在 [`core/registry.ts`](src/core/registry.ts) 掛上(順序 = 面板順序)→ 在 [`index.ts`](src/index.ts) 匯出。
