# 專案規劃 — 前台中心

> 邁向「製作」:里程碑與 v1 建置順序。**先規劃,實作屆時啟動。**
> 系統設計見 [technical/](technical/)(00–07)。⚠️ 草擬,待 PO 核定。

## 原則

- 架構整體設計好(00–07),但**只 JIT 造 v1 需要的**;抽象(op 清單、三類別、分層快取介面)先埋,串流 / feature-store / edge 延後。
- Stack:**Rust**(axum / sqlx / moka / Maud|Askama)· **Postgres + JSONB** · **Valkey** · 編輯器 **React + Antd + TanStack**(**Node 26 + pnpm**)· 區塊 **Web Components** · 資產 **GCS / FS**。

## v1 里程碑(全靜態、無商品)

| # | 里程碑 | 內容 |
|---|--------|------|
| **M1** | 骨架 | axum + tokio + tower、Postgres schema、多租戶解析、config |
| **M2** | 編輯 API | 頁面 CRUD、草稿 / 發布、區段組、全站設定、`block-types`、資產上傳 |
| **M3** | 區塊型別系統 | 4 型別(banner / text-list / image / container)+ schema;Maud/Askama 渲染 + WC 前端元件 |
| **M4** | 渲染引擎(靜態) | render plan 編譯(只 STATIC、整頁併 Bytes、`publish_version` 鍵)+ moka + 發布清快取 |
| **M5** | 編輯器前端 | React + Antd + TanStack:結構樹 / 拖拉 / 設定表單(依 schema)/ 即時預覽(client WC)/ 桌機手機 / 草稿發布 |
| **M6** | 打通 | 建站端到端:設全站 → 編 header/footer → 拼首頁 → 發布 → 訪客 SSR 看得到 |

## v1 驗收(完成的定義)

- **商家**:拖區塊拼首頁 / 活動頁 / 自訂頁、設 header/footer、即時預覽**不打網路**、發布。
- **訪客**:SSR HTML、SEO meta 出得來、**只載用到的**區塊、多租戶隔離。
- **載頁熱路徑 0 DB**(cache 命中)。

## 之後(對照渲染引擎分期,見 [technical/02](technical/02-render-engine.md))

- **v2 商品**:商品 / 分類區塊 + DYN_SHARED(熱銷,微快取 + SWR)。
- **v3 個人化**:feature store、segment、out-of-order 串流。
- **v4 edge**。

## 現階段

**先規劃、不實作。** 商業視角 + 技術系統設計已立;待 PO 審定後啟動 M1。
