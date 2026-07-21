# rust_point — 電商後端 monorepo

以 Rust 打造的電商後端 monorepo:一個 bounded context 一顆自包含子樹,context 內採 **Package by Component**。第一個 context 為**點數中心(point-center)**:發點入帳、兌換(防超扣)、餘額與到期、交易帳本。未來的 `order`、`member`、`dispatch` 等 context 陸續進場,各自成家。

> **目前狀態:規格設計階段**——採文件先行的迭代開發,規格審查通過後才動工。

## 系統邊界

點數中心**只做帳務**;「何時發、發給誰」(發送排程器、動態名單)屬於其他限界上下文,透過公開 API 對接:

```
┌─ 外部呼叫方 ────────────┐
│ 營運後台(人工)          │           ┌──────── 點數中心(本系統)────────┐
│ 發送排程器(未來 app)    │──公開 API──▶│ 發點入帳 │ 兌換 │ 餘額/到期 │ 帳本 │
│ 名單中心(推送 JSONL)    │           └──────────────────────────────────┘
└─────────────────────────┘
```

## 核心設計亮點

- **一次發點 = 一個任務**:千萬級名單以 JSONL 串流上傳(可續傳)、單一任務批量入帳,不逐人排隊。
- **來源即冪等**:每筆異動必帶 `(author, sourceId)`,重送保護、防重複給點、帳務溯源三合一,無人工冪等鍵。
- **絕不超扣**:悲觀鎖(`SELECT … FOR UPDATE`)與樂觀條件式更新兩種兌換策略,可切換對比壓測。
- **生效窗**:點數具 `[生效, 到期)` 時間窗,查詢級瞬間生效,不依賴排程。
- **必達終態**:發點任務保證到達 `completed` 或 `failed`,崩潰(OOM / container 被收)靠訊息層自癒、冪等續跑。
- **多租戶**:`shop_id` 為一切唯一鍵與查詢之首,跨 shop 結構性隔離。
- **軟刪除**:無物理 DELETE;刪除語意以狀態表達(如 `:cancel`),帳本 append-only。

## 架構

兩層結構:**monorepo 層 = bounded context 各自成家**(`projects/` 一 context 一子樹:components、apps、自有基礎設施與指令收在一起);**context 內 = Package by Component**(component = 業務能力 + 它的資料存取,只暴露公開 API),component 內部是六角 × 乾淨架構 × CQRS,`apps/` 只是 shell:

```
docker-compose.yml   # 共享基礎設施:只放跨 context 的 NATS 訊息匯流排
Makefile             # 協調:up/down 與 cargo 指令逐 project 轉發(root 無 Cargo.toml)
projects/
  point-center/      # bounded context「點數中心」——自包含子樹
    Cargo.toml         # context 自己的 Cargo workspace(+ Cargo.lock)——一 project 一 workspace
    docker-compose.yml # 自有基礎設施:每個 context 有獨自的 DB(PostgreSQL)
    Makefile           # context 級指令(up / migrate / 各 app / build / test / lint)
    platform/          # 技術 plumbing(非業務)
      db/              # PgPool + sqlx migrator + migrations/(schema 真相來源)
    components/        # 業務能力元件(component = core + adapters)
      ledger/          # 帳本:批次、交易、FIFO、兌換/入帳/到期
      issuance/        # 發點流程:狀態機、上傳 session、任務處理
    apps/              # shell:delivery + composition root,不含業務
      internal-api/    # 後台:發點生命週期(UC-1/5/6)
      storefront-api/  # 前台系統串接:兌換/餘額/交易(UC-2/3/4)
      grant-worker/    # NATS consumer(入帳管線)
      expiry-job/      # run-to-completion 到期清掃(排程外部化)
```

編譯期強制:component 只暴露公開 API(crate 可視性)、core 不列 tokio/sqlx/NATS、跨 component 僅 `issuance-core → ledger-core`(grant API)。**context 之間禁止 Cargo 依賴、禁止共用 DB**(一 project 一 Cargo workspace、root 無 Cargo.toml,隔離是結構性的),只透過公開 API 與 NATS 事件溝通;未來的 context(`order`、`member`、`dispatch`…)進場即各自成家。

## 技術棧

| 層面 | 選型 |
|------|------|
| Runtime / HTTP | tokio + axum |
| 訊息 | NATS JetStream(async-nats) |
| 資料庫 | PostgreSQL + sqlx |
| 名單儲存 | v1 本機檔案系統 → 正式 GCS(`RecipientListStore` port) |
| ID | UUID v7(全域統一規範) |
| 觀測 | tracing + OpenTelemetry(OTLP;dev 後端 grafana/otel-lgtm) |

完整選型理由與替代方案:[docs/tech/01-tech-stack.md](docs/tech/01-tech-stack.md)

## 文件

| 系列 | 內容 |
|------|------|
| [docs/plan/](docs/plan/) | 業務規格(Use Case 合約、Domain 設計、DB 設計、狀態圖與時序圖、驗收條件) |
| [docs/tech/](docs/tech/) | 技術決策紀錄(選型、理由、替代方案、工程規約) |

文件採編號迭代(`01-…`、`02-…`),先審查後實作;內容維持現在式,決策軌跡記於 [docs/progress/](docs/progress/);跨 context 未排程議題在 [docs/plan/backlog.md](docs/plan/backlog.md)。

## 開發流程(規劃)

```bash
make up                                # 共享基礎設施(NATS)+ 協調各 context 起自有 DB
make test                              # 協調:逐 context 跑各自 workspace 的測試
make -C projects/point-center internal-api   # 後台 API
make -C projects/point-center storefront-api # 前台系統串接的 API
make -C projects/point-center grant-worker   # 入帳 worker(多開終端 = 多實例)
make -C projects/point-center expiry-job     # 到期清掃(單次執行)
make -C projects/point-center test           # 只測這個 context 的 workspace
```

root Makefile 只做共享基礎設施(NATS)與協調;context 專屬指令一律住在 `projects/<context>/Makefile`。容器引擎自動偵測(**podman 優先**,否則 docker),可覆寫:`make up COMPOSE="docker compose"`。

## Roadmap

- [x] 點數中心 v1 規格(docs/plan/01-point-center)
- [x] 技術決策(docs/tech/01 選型、02 佈局、03 觀測)
- [ ] v1 實作:components(ledger、issuance)/ apps ×4
- [ ] 驗收:併發兌換不超扣、大批量單一任務、斷點續跑、來源防重複、多 worker、租戶隔離、本機 Grafana 觀測
- [ ] 發送排程器(monorepo 內獨立 context,另立計畫文件)
