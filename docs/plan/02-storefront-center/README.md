# 前台中心

> 一套**可客製化的前台頁面系統**:頁面 layout 以 **Tree** 定義,後台可編排**內容 / 排版 / 曝光版位**。
> 現階段:**商業視角規劃**(先規劃、不實作),依「商業先、技術後」與 `point-center` 同格式。
> ⚠️ 早期草擬,邊寫邊跟 PO 核對。代號 `storefront-center`。

## 商業視角(read-first;PO 觀點,零技術)

- [00 願景與問題](business/00-vision.md)
- [01 邊界與非目標](business/01-scope.md)
- [02 角色與利害關係人](business/02-stakeholders.md)
- [03 商業詞彙表](business/03-glossary.md)
- [04 頁面模型(對標業界主流組頁模型)](business/04-page-model.md) — **含 ASCII 圖**
- [05 商業能力(編輯與發布)](business/05-capabilities.md) — **含編輯器 ASCII**
- [06 商業規則與政策](business/06-business-rules.md)
- [07 場景旅程](business/07-journeys.md)
- [08 User Story 與驗收條件](business/08-stories.md)
- [09 變體的生效與定向(檔期 / 受眾 / 優先序)](business/09-variant-scheduling-and-targeting.md) — **含時間軸 ASCII**

## 技術視角(建置中;先規劃不實作)

- [00 技術總覽](technical/00-overview.md) — 系統形狀(訪客 / 商家 / 共用核心 / 資料)
- [01 技術選型與引擎方向](technical/01-decisions.md) — 前台**純 Rust SSR 引擎**、區塊 **Web Components**、後台 **React + Antd + TanStack**
- [02 渲染引擎(高 RPS 個人化 SSR)](technical/02-render-engine.md) — **黑科技**:編譯 render plan、三類別快取、out-of-order 串流、feature store;v1/v2/v3 分期
- [03 使用案例(時序圖)](technical/03-flows.md) — 訪客載頁、商家編輯發布、區段組發布
- [04 對外 API](technical/04-api.md) — 公開頁服務 + 編輯 API
- [05 內部組成](technical/05-components.md) — 慣用 Rust 模組(render / blocks / cache / store / api …)
- [06 資料存取](technical/06-data-access.md) — Postgres + JSONB schema、快取、GCS/FS
- [07 IO / 成本盤點](technical/07-io-cost.md) — 每路徑 IO;載頁熱路徑 0 DB
- [08 事件與擴充架構](technical/08-event-and-extension-architecture.md) — sf-event 脊椎、觀察者 / 插件、兩平面
- [09 第三方與市集](technical/09-third-party-and-marketplace.md) — 四層信任模型、WASM 沙箱、治理
- [10 變體解析(決策層)](technical/10-variant-resolution.md) — filter(時間∧受眾∧來源)→ sort(priority);純函式可快取;render(02)之前的入口決策

## 專案規劃

- [project-plan](project-plan.md) — v1 里程碑(M1–M6)、驗收、之後 v2/v3/v4。**先規劃、不實作。**

## 路線圖

- 見 [../roadmap.md](../roadmap.md)。前台中心 = 建置第 1 步。**v1 不含**登入、商品、結帳、購物。
