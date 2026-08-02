# 04 — 對外 API

> 技術視角:系統對外的介面(由外而內的第一層)。兩個面:**公開頁服務**(訪客)+ **編輯 API**(商家後台)。
> 先規劃、不實作。⚠️ 草擬,待 PO 核對。

## 兩個對外面

- **公開頁服務**(訪客 ↔ Rust 引擎):`GET /{頁面路徑}` → SSR HTML。**非 REST,是頁面渲染端點**(走引擎,見 [03](03-flows.md) / [02](02-render-engine.md))。
- **編輯 API**(React 編輯器 ↔ Rust 後端):對頁面 / 區塊 / 設定 / 草稿 / 發布 / 資產的讀寫。

## 公開頁服務(訪客,只讀無狀態)

- `GET /{slug}`——租戶由網域 / 子網域 / 路徑決定;cache 命中即吐,miss 才走引擎組裝。
- 回應帶 **SEO meta**(title / description / canonical / OG);`404` 頁;`robots.txt` / `sitemap.xml`。
- 無狀態、可 CDN / edge 前置。

## 編輯 API(草稿 / 發布導向,一切以 tenant 為界)

| 方法 · 路徑 | 用途 |
|-------------|------|
| `GET /pages?type=&status=` | 列頁面(依類型 / 草稿發布) |
| `POST /pages` | 建頁面(選類型) |
| `GET /pages/{id}` | 取草稿(頁面 = 區塊樹 JSON) |
| `PUT /pages/{id}` | 存草稿 |
| `POST /pages/{id}:publish` | **發布** → 編譯 render plan + 清該頁快取 |
| `GET /pages/{id}/published` | 取發布版 |
| `GET` / `PUT /section-groups/{type}` | header / footer / 公告(共用,發布清全站相關快取) |
| `GET` / `PUT /theme-settings` | 全站設定(品牌色 / 字型 / logo) |
| `GET /block-types` | **區塊庫**:型別 + schema(編輯器據以生成設定表單) |
| `POST /assets` | 上傳圖片 → GCS / FS,回 URL |

## 慣例

- **多租戶**:每個讀寫都以 tenant 起頭、互不可見。
- **草稿 vs 發布分離**:編輯只動草稿;**發布是顯式動作**(觸發編譯 + 清快取)。
- **schema 單一真相**:區塊型別的 schema 由後端 `GET /block-types` 提供,編輯器**據以生成設定表單**——前後端不各寫一套。
- **認證 / 授權**:商家身分屬會員 / 身分系統(之後接);此處假設呼叫端已獲授權。
- **即時預覽不經此 API**:編輯時的預覽是 client-side WC 本地重繪(不打網路);此 API 只在**開啟 / 存草稿 / 發布 / 上傳**時被呼叫。
