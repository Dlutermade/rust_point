# 01 — 技術選型與引擎方向

> 技術視角:此中心**已拍板**的技術方向,與**待深研**的引擎。先規劃、不實作。
> ⚠️ 決策隨討論演進;渲染引擎細節待研究後補。

## 已定

### 前台(訪客端)

- **純 Rust 渲染引擎**——不把 Node 放進**每請求熱路徑**(理由:**RPS / 吞吐**)。
- **MPA + SSR + SEO**;**只載用到的**(逐頁 code-split)。

### 區塊

- **Web Components(Lit)**:Web 標準、框架無關、封裝(Shadow DOM)、**一次寫**、長命不隨框架汰換。
- **角色縮小為「互動 + 真正 live 的 client 行為」**(輪播、按鈕動作…);**資料與個人化的重活交給引擎 SSR**(見下)。

### 後台(編輯器)

- **React + Ant Design(Antd) + TanStack Query + TanStack Router**(**Node 26 + pnpm**)。
- **即時預覽 = client-side、編輯不重打網路**:同一顆 WC 在編輯器 client 即時重繪,改設定即時反映。
- **Store Layer = TanStack Query**(快取 / 去重),避免多區塊重複打同一 API。

### 渲染模式(每個區塊型別自宣告)

| 模式 | 例子 | 怎麼出 |
|------|------|--------|
| **靜態** | banner / 文字 / 圖 / 容器 | publish 預渲染 + 快取,Rust 吐 |
| **動態共享**(會變、大家一樣) | 熱銷榜 | 短 TTL 快取 / 引擎 SSR |
| **個人化**(每人不同) | 為你推薦 | **引擎 per-user SSR**(靠熱資料層),必要時才 client |

### 資料庫:PostgreSQL + JSONB

- **存什麼**:頁面(區塊樹存 **JSONB**)、區段組、全站設定、草稿 ↔ 發布版本、資產 metadata——都是**文件形狀 + 少量關聯**(租戶 / 頁面索引 / 版本)。
- **為什麼**:一套搞定文件 + 關聯、成熟、`sqlx` 支援好。**熱讀路徑走快取 / 編譯計畫、不打 DB**,故 DB 只是「編輯 / 發布的權威 store」,Postgres 綽綽有餘。資產本體進 **GCS / FS**;快取與 feature store 走 **Valkey**。

### 程式架構:慣用 Rust,不套六角 / 乾淨架構

- 此中心**不遵守 point-center 的六角 + Package-by-Component**(已明示放行)。改用**慣用 Rust**:依功能分 module、`axum` handler、`sqlx` 直用、型別化 struct、`thiserror` / `anyhow`——不為領域純度上 ports / adapters 的儀式。
- **理由**:前台中心的價值在**引擎 / 渲染 / 效能**,不是領域邏輯純度;基礎設施重、領域輕,慣用 Rust 更直接。

## 探索中:黑科技 = Rust 個人化 SSR 引擎

**目標**:連**個人化、會變**的內容都**伺服器端渲染**,且**高 RPS**——這是差異化(Shopify / 一線 storefront builder 多半閃躲,把個人化丟 client 或不做 SSR)。

手法(待研究補藍圖):

- **render-tree 編譯**:把頁面(區塊樹)編譯成最佳化 render plan,服務時只跑它 + 灌資料(不每請求重解析)。
- **fragment 級快取**:每塊自己的 key + 多 TTL(靜態永快取、熱銷 60s、個人化不快取);組頁 = 大量命中 + 少量 per-user 渲染。
- **single-flight / request coalescing**:同一動態 fragment 併發只算一次。
- **個人化 SSR 便宜化**:離線**預算**推薦 / 排序 → 灌線上**熱資料層** → per-user 渲染變「**查表 + 拼接**」而非重算。
- **streaming / out-of-order SSR**:先吐靜態外殼(快 TTFB),個人化 fragment 資料到了再串進去。

## Store Layer

- 共用的 client 快取 / 去重層,避免多區塊重複打同一 API。
- 編輯器 = **TanStack Query**;前台 = 輕量共用快取(供 client 端的互動 / live 區塊)。

## 一句話定調

**前台純 Rust 引擎(高 RPS、連個人化都 SSR)· 區塊 Web Components(互動)· 後台 React+Antd+TanStack · 組頁模型參考業界主流、渲染方式自建。**
