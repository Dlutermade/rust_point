# 01 — 技術選型記錄

> 狀態:**待審查**
> 範圍:點數中心 v1(對應 `docs/plan/01-points-center-spec.md` r18)。每項記錄:決策、理由、曾考慮的替代方案。日後選型變更以新編號文件記錄,不回改本文件。

## 1. 核心技術線(使用者定案)

| 項目 | 決策 | 版本 |
|------|------|------|
| 語言 | Rust | stable 1.97.0 |
| 非同步 Runtime | tokio | 1.x |
| 訊息基礎設施 | NATS JetStream | server 2.x / async-nats 0.49 |

這兩條是專案前提(tokio 技術線 + NATS JetStream),其餘選型圍繞它們展開。

## 2. 選型明細

### 2.1 HTTP 框架 — axum 0.8

- **理由**:tokio 官方生態,與 tower middleware 原生整合;body stream API 直接支援本專案的 NDJSON 串流上傳/下載;社群主流。
- **替代方案**:actix-web(自有 runtime 抽象,與 tokio 生態整合較繞)、poem(生態較小)。

### 2.2 訊息 — async-nats 0.49(JetStream Stream)

- **理由**:NATS 官方維護、原生 tokio;Stream 提供 at-least-once 任務投遞(explicit ack、`AckKind::Progress` 長任務保活、max_deliver)與終態事件發布。
- **範圍限定**:NATS 只做訊息,**不兼職物件儲存**(名單儲存見 §2.3)。

### 2.3 名單儲存 — `RecipientListStore` port:v1 本機檔案系統 → 正式 GCS

- **決策**:千萬級 JSONL 名單經 `RecipientListStore` port 存取;**v1 adapter = 本機檔案系統**(開發零依賴;docker compose 以共享 volume 讓 api 與多個 worker 讀寫同一目錄),**正式環境 adapter = GCS**(最終目標;「JSONL + GCS」即業界名單交換慣例)。儲存引用以 **URI** 表達(`file://…` / `gs://…`),scheme 自帶 adapter 語意。
- **整合測試**:GCS adapter 開發時以 fake-gcs-server 做整測。
- **替代方案**:NATS Object Store(否決——不讓訊息系統兼職儲存)、名單存 PG(單列放不下,否決)、MinIO/S3(非最終目標,不必要)。

### 2.4 訊息格式 — JSON(serde_json)/ 名單 JSONL

- **理由**:單人開發 + 全 Rust + 迭代期,可讀性與除錯效率優先(`nats stream view` 直接可讀);wire DTO 帶版本(`IssuanceTaskV1`),編解碼收斂於 infra,未來換格式是局部改動。名單以 JSONL(一行一個 JSON 物件)串流,行格式為物件是為會員群組等擴充預留。
- **替代方案**:protobuf/prost(schema 演進與跨語言強,但 v1 無跨語言消費者,建置成本先不付)、MessagePack(無 schema 又不可讀,兩頭不討好,否決)。

### 2.5 資料庫 — PostgreSQL 17 + sqlx 0.9

- **理由**:sqlx 為 async 原生、SQL 直寫不強加 ORM 抽象——本專案的核心價值就在手寫 tx / `FOR UPDATE` / 條件式 UPDATE / 多列批量 INSERT,ORM 反而礙事;`sqlx::migrate!` 內嵌遷移。PG 提供本專案依賴的鎖語意與 `ON CONFLICT DO NOTHING`。
- **替代方案**:SeaORM(ORM 抽象與鎖控制的細膩度衝突)、MySQL(鎖行為與 RETURNING 支援較弱)。
- **查詢風格**:runtime 綁定(`sqlx::query` / `query_as`),不用編譯期 macro 檢查——避免建置依賴 DATABASE_URL;此取捨若日後反悔,可漸進改用 offline 模式。

### 2.6 ID — UUID v7(uuid crate,全域統一規範)

- **理由**:時間有序,大批量插入時主鍵索引順序寫入(v4 隨機打散索引頁,千萬級入帳場景差距顯著);**統一規範,不限本專案**。`source_id` 為呼叫端自定義字串,不在此規範內。
- **替代方案**:v4(索引局部性差,否決)、自增 bigint(跨服務暴露序號、合併資料衝突,否決)。

### 2.7 觀測 — tracing + tracing-subscriber(env-filter)

- **理由**:tokio 官方生態;`#[tracing::instrument]` 建 span 跨層追蹤;`RUST_LOG` 執行期調整;結構化欄位(customer_id、issuance_id、author、source_id、amount、elapsed_ms)為壓測與除錯的一等公民。日後接 OpenTelemetry 有現成橋接。

### 2.8 錯誤處理 — thiserror(lib 層)/ anyhow(bin 層)

- **理由**:社群慣例。domain/application 以 thiserror 定義具型別錯誤(呼應 API 的結構化錯誤欄位);apps 的 main 以 anyhow 收尾。

### 2.9 時間 — chrono

- **理由**:sqlx/serde 整合成熟;生效窗與到期計算皆為 UTC 絕對時間,v1 無時區運算需求(排程器已移出本 context;屆時該 app 自行引入 chrono-tz)。

## 3. 開發環境與流程

| 項目 | 決策 | 說明 |
|------|------|------|
| 基礎設施 | docker compose | NATS(`-js`)+ PostgreSQL 17 + 名單共享 volume;服務本體 local `cargo run` |
| 指令收斂 | Makefile | `make up / api / worker / test / lint …` |
| 多實例模擬 | 多終端 `make worker`;Docker 化後 `docker compose up --scale worker=N` | competing consumers 驗證 |
| workspace | Cargo workspace,`resolver = "3"`,`edition = "2024"` | 依賴版本以 `[workspace.dependencies]` 統一 |
| crate 佈局 | `crates/domain|application|infra` + `apps/api|worker` | 依賴方向 `apps → infra → application → domain`;`apps/` 命名避開 DDD service 術語 |

## 4. 工程規約(跨文件通用)

- **API 欄位 camelCase;snake_case 僅存在於 DB**;數值欄位以 amount 概念命名,points 保留為領域概念名。
- **headers 不承載業務資料**(`Content-Type`、`Upload-Offset` 等傳輸層語意除外)。
- **無人工冪等鍵**:重送保護一律由業務來源鍵 `(author, sourceId)` 承擔(來源即冪等、即溯源)。
- **狀態轉移用自訂方法**(AIP-136:`:issue`);PATCH 僅更新欄位。
- **大名單一律 JSONL 串流**(上傳可續傳、下載可核對),無內嵌通道、無人數門檻。
- 文件:規格在 `docs/plan/NN-*.md`、技術決策在 `docs/tech/NN-*.md`,皆先審後做;繁體中文,程式碼與識別字英文。

## 5. 版本錨點(2026-07-17)

```toml
tokio = "1"            # 1.52.x
axum = "0.8"           # 0.8.9
async-nats = "0.49"    # 0.49.1
sqlx = "0.9"           # 0.9.0(features: runtime-tokio, postgres, uuid, chrono)
serde = "1"            # + serde_json = "1"
uuid = "1"             # features: v7, serde
chrono = "0.4"         # features: serde
tracing = "0.1"        # + tracing-subscriber = "0.3"(env-filter)
thiserror = "2"
anyhow = "1"
tower-http = "0.7"     # features: trace
futures = "0.3"
```

Rust toolchain:1.97.0(sqlx 0.9 要求 ≥1.94)。

---

*審查通過後依此開工;選型變更走新編號文件(`02-…`),保留決策軌跡。*
