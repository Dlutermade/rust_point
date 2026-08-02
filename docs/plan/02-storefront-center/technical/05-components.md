# 05 — 內部組成

> 技術視角:系統由哪些部分組成——**慣用 Rust,不套六角 / 乾淨架構**。
> 先規劃、不實作。⚠️ 草擬。

## 部署體(後端是一組服務,非單一 API server)

- **公開頁服務**(訪客):Rust 引擎,SSR HTML,**高 RPS、唯讀、快取、串流**——獨立擴展。
- **編輯 / 管理 API**(商家):Rust axum,CRUD、草稿 / 發布、資產。
- **發布 / 編譯 worker**:publish 時編譯 render plan + 清 / 暖快取(可非同步)。
- **個人化 pipeline**(v3):離線批次算推薦 / 排序 → feature store(非請求服務)。
- **資產處理**:圖片上傳 / 縮圖 → GCS。
- **編輯器前端**:React SPA(Antd + TanStack),靜態前端,打編輯 API。
- 共用:同 workspace 的 Rust crate(渲染核心、資料層、型別)+ DB + Valkey + 物件儲存。
- **v1 可先合併部署**(如公開頁 + 編輯 API 同進程),隨規模拆開。

## 主要模組(依功能分,不上 ports/adapters)

| 模組 | 職責 |
|------|------|
| `render` | render plan 編譯 + 執行(op 清單、三類別、Maud/Askama 區塊渲染) |
| `blocks` | 區塊型別註冊表(型別 + schema + 渲染函式);v1:banner / text-list / image / container |
| `cache` | moka L1 + Valkey L2;fragment 快取、single-flight、SWR、`publish_version` 失效 |
| `store` | 資料存取(`sqlx` + Postgres):頁面 / 區段組 / 設定 / 版本,JSONB |
| `assets` | 圖片上傳到 GCS / FS,回 URL |
| `api` | axum handlers:編輯 API + 公開頁服務;`tower` 中介(逾時 / 併發限 / tracing) |
| `tenant` | 多租戶解析(網域 / 路徑 → tenant)與隔離 |
| `personalize`(未來,v3) | feature store 讀取、segment 計算 |

## 組裝(慣用 Rust)

- axum `State` 直接帶 `PgPool`、`moka::Cache`、Valkey client、config——**直接用,不上 `Arc<dyn Trait>` ports 儀式**(除非真要抽換)。
- 錯誤:`thiserror`(lib)/ `anyhow`(bin);handler 回結構化錯誤。
- 前端 WC(區塊的互動 / client 行為)獨立打包,**依區塊型別 lazy load**(只載頁面用到的)。

## 與 point-center 的差異

- **不**六角、**不** Package-by-Component;就是慣用 Rust workspace + 功能模組。
- 理由見 [01](01-decisions.md):價值在引擎 / 渲染 / 效能,基礎設施重、領域輕。
