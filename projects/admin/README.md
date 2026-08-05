# admin — 前台中心編輯器

`storefront-center` 的商家後台:拖拉區塊組頁、設定頁首 / 頁尾、即時預覽、草稿與發布。規格見 [`docs/plan/02-storefront-center/`](../../docs/plan/02-storefront-center/)(對應里程碑 M5)。

## 現況

編輯器本身已完整;**資料源仍是 [`src/api/mock.ts`](src/api/mock.ts)**(記憶體 / localStorage),真後端尚未接上。mock 的合約與 Rust 端編輯 API 一比一對齊(Model B、camelCase),接線時只換 `src/api/` 那一層,路由與元件不動。

## 佈局

```
src/
  api/                # 資料層 —— 接線時只動這裡
    types.ts            # 與後端共用的契約(模板 / 狀態 / targeting / 區塊實例)
    mock.ts             # 目前的資料源;真後端接上即淘汰
    home|header|footer.ts  # 三個版位各自的 API 門面,不吃 slot 參數
    resolve.ts          # 變體解析(檔期 ∧ 受眾 ∧ 來源 → priority)
  routes/             # TanStack Router 檔案式路由(routeTree.gen.ts 自動產生,勿手改)
    _shell/pages/{home,header,footer}/   # 列表 / 新增 / 編輯
  page-block-editor/  # 編輯器本體
    BlockTreeEditor      # 結構樹 + 拖拉
    BlockList / BlockView
    SettingsPanel        # 依 schema 生成設定表單
    PreviewCanvas        # 即時預覽(client 端 WC,不打網路)
    SelectionOverlay     # 畫布上的選取 / 尺寸控制
    TargetingFields      # 生效條件(檔期 / 受眾 / UTM)
    AuditDrawer          # 異動紀錄
  preview/            # 前台預覽端點(preview.html),獨立 bundle
  shared/http.ts      # axios 實例(baseURL /api + token 攔截器)
```

兩個打包端點:`index.html`(admin SPA)與 `preview.html`(前台預覽)各自成 bundle,不共用 router / provider / 全域狀態。

區塊型別來自 workspace 套件 [`@sc/blocks`](../blocks/)(Lit Web Components),編輯器的設定表單與預覽都吃它匯出的 schema。

## 開發

```bash
pnpm install                      # 在 repo root 跑(pnpm workspace)
pnpm --filter @sc/blocks build    # admin 透過 dist/ 解析 @sc/blocks,需先 build
pnpm dev                          # vite dev server
pnpm build                        # tsc -b && vite build
pnpm lint                         # oxlint
pnpm format                       # oxfmt src
```

repo root 也有 `make web-dev`(自動先 build blocks)與 `make web-build`。
