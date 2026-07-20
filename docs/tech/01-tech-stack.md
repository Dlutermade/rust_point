# 01 — 技術選型

> 狀態:**待審查**
> 範圍:point-center v1(規格:`docs/plan/01-point-center/`)。
> 本文維持現在式;決策軌跡記於 `docs/progress`。

## 核心技術線

| 項目 | 決策 |
|------|------|
| 語言 | Rust stable **1.97.1**(edition 2024) |
| 非同步 runtime | tokio **1.53.0** |
| 訊息 | NATS JetStream(server **2.14.3** / async-nats **0.49.1**) |

## 選型與理由

### HTTP — axum 0.8.9

- tokio 官方生態,tower middleware 原生整合;body stream 直接支援分塊串流上傳。
- 替代:actix-web(自有 runtime 抽象,整合較繞)、poem(生態較小)。

### 訊息 — async-nats 0.49.1(JetStream)

- at-least-once 投遞:explicit ack、`AckKind::Progress` 長任務保活、`max_deliver`。
- NATS 只做訊息,不兼職物件儲存(名單另走儲存 port)。

### 名單儲存 — `RecipientListStore` port

- v1 本機檔案系統(`file://`)→ 正式 GCS(`gs://`);URI scheme 自帶 adapter 語意。
- GCS adapter 整測用 fake-gcs-server。
- 替代:NATS Object Store(訊息系統兼職儲存,否決)、名單落 PG(單列放不下,否決)。

### 訊息格式 — JSON(serde 1.0.229 / serde_json 1.0.150)

- 迭代期可讀性優先(`nats stream view` 直接可讀);wire DTO 帶版本(如 `IssuanceTaskV1`)。
- 名單為 JSONL,一行一個 JSON 物件(物件形式為擴充留位)。
- 替代:protobuf(v1 無跨語言消費者,建置成本先不付)、MessagePack(無 schema 又不可讀,否決)。

### 資料庫 — PostgreSQL 18.4 + sqlx 0.9.0

- sqlx:async 原生、SQL 直寫——本專案核心價值在手寫 tx / `FOR UPDATE` / 條件式 UPDATE / 批量 INSERT。
- 查詢用 runtime 綁定(`query` / `query_as`),不用 `query!` 編譯期檢查(建置不依賴 DATABASE_URL)。
- `macros` feature 只為 `sqlx::migrate!` 內嵌遷移保留。
- PG 18 原生 `uuidv7()`:對帳腳本 / seed 可直接用(應用 ID 仍由程式生成)。
- 替代:SeaORM(ORM 抽象與鎖控制細膩度衝突)、MySQL(鎖語意與 RETURNING 較弱)。

### ID — UUID v7(uuid 1.24.0)

- 時間有序:大批量插入時主鍵索引順序寫入;全系統統一規範。
- `source_id` 為呼叫端自定義字串,不在此規範內。

### 觀測 — tracing 0.1.44 + OpenTelemetry

- tracing 為發聲門面(全 crate 依賴);訂閱端 tracing-subscriber 0.3.23(env-filter、json)。
- OTel 已定案並接線(靜默停用、span links、基數紀律):決策與版本錨點見 tech/03。

### 錯誤 — thiserror 2.0.19(lib)/ anyhow 1.0.104(bin)

- 具型別錯誤呼應 API 的結構化錯誤欄位;bin 的 main 以 anyhow 收尾。

### 時間 — chrono 0.4.45

- 一律 UTC 絕對時間;v1 無時區運算(排程器 context 屆時自帶 chrono-tz)。

## 開發環境

| 項目 | 決策 |
|------|------|
| 容器引擎 | `COMPOSE ?=` 自動偵測,**podman 優先**、docker fallback;compose 檔為 Compose Spec 中立 |
| 基礎設施佈局 | root = 共享 NATS;各 context 自有 DB——詳 tech/02 |
| 指令 | Makefile 兩層:root 協調、context 自持——詳 tech/02 |
| 多實例模擬 | 多開 `make grant-worker`;容器化後 `--scale grant-worker=N` |
| 映像 | `nats:2.14.3-alpine`、`postgres:18.4-alpine` |

## 工程規約(跨文件)

- API 合約慣例(camelCase、來源即冪等、軟刪除、JSON 物件包裹…)統一定義於 `plan/01-point-center/api.md`,不在此重複。
- 文件:編號迭代、先審後做;內容維持現在式;繁體中文,程式碼與識別字英文。
- 註解:直述「為什麼」,不作文件指標;敘述性註解不寫。
- doc comment 即 rustdoc(Markdown):首句自成摘要;跨型別引用用 intra-doc link(`[\`Type\`]`);識別字/字面值用反引號;範例用 fenced code block(即 doc-test);用語一律全名(use case interactor,不簡稱 interactor)。已知陷阱:link 後緊接全形括號會被解析為 link destination。
- **core 註解只講契約**:不洩漏單一 adapter 的實作(如 PG 函式名、SQL 語法)——那些歸 internals 與 adapter 本身;`cargo doc` 零警告納入每輪檢查(test / clippy / fmt / doc)。
- 依賴:features 明列、版本寫完整版號;升版後以 `cargo tree -d` 驗無版本分裂。

## 版本錨點(2026-07-19)

```toml
tokio       = "1.53.0"   # full
axum        = "0.8.9"
tower-http  = "0.7.0"    # trace, request-id, catch-panic
async-nats  = "0.49.1"
sqlx        = "0.9.0"    # runtime-tokio, postgres, uuid, chrono, json, migrate, macros, derive
serde       = "1.0.229"  # derive
serde_json  = "1.0.150"
uuid        = "1.24.0"   # v7, serde
chrono      = "0.4.45"   # serde
thiserror   = "2.0.19"
anyhow      = "1.0.104"
async-trait = "0.1.91"
futures     = "0.3.33"
tracing     = "0.1.44"
tracing-subscriber = "0.3.23"  # env-filter, json
```

- OpenTelemetry 四件套的錨點在 tech/03 §7(需互相咬合,單獨管理)。
- Rust toolchain **1.97.1**(sqlx 0.9 要求 ≥ 1.94)。
