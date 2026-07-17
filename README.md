# rust_point — 點數中心(Points Center)

以 Rust 打造的電商點數中心後端 monorepo:發點入帳、兌換(防超扣)、餘額與到期、交易帳本。

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

## 架構

六角架構 × 乾淨架構 × CQRS:

```
projects/
  points/            # bounded context「點數中心」——libs 與部署單元同一子樹
    crates/
      domain/        # Entities + Domain Services(FIFO 分攤,純函式)
      application/   # commands/ + queries/(use case interactors)、ports
      infra/         # outbound adapters:PostgreSQL、NATS(Stream)、名單儲存(檔案系統 → GCS)
    apps/
      api/           # points-api:HTTP inbound adapter(axum:Controller + Presenter)
      worker/        # points-worker:NATS 任務 consumer + 到期週期任務
```

依賴方向嚴格單向:`apps → points-infra → points-application → points-domain`。未來的 bounded context(如發送排程器)各自成家(`projects/dispatch/…`);**context 之間禁止 Cargo 依賴**,只透過公開 API 與 NATS 事件溝通。

## 技術棧

| 層面 | 選型 |
|------|------|
| Runtime / HTTP | tokio + axum |
| 訊息 | NATS JetStream(async-nats) |
| 資料庫 | PostgreSQL + sqlx |
| 名單儲存 | v1 本機檔案系統 → 正式 GCS(`RecipientListStore` port) |
| ID | UUID v7(全域統一規範) |
| 觀測 | tracing |

完整選型理由與替代方案:[docs/tech/01-tech-stack.md](docs/tech/01-tech-stack.md)

## 文件

| 系列 | 內容 |
|------|------|
| [docs/plan/](docs/plan/) | 業務規格(Use Case 合約、Domain 設計、DB 設計、狀態圖與時序圖、驗收條件) |
| [docs/tech/](docs/tech/) | 技術決策紀錄(選型、理由、替代方案、工程規約) |

文件採編號迭代(`01-…`、`02-…`),先審查後實作;變更走新編號,保留決策軌跡。

## 開發流程(規劃)

```bash
make up        # docker compose 啟動 NATS + PostgreSQL
make api       # 啟動 API 服務
make worker    # 啟動 worker(多開終端 = 多實例模擬)
make test      # cargo test
```

## Roadmap

- [x] 點數中心 v1 規格(docs/plan/01)
- [x] 技術選型紀錄(docs/tech/01)
- [ ] v1 實作:workspace / domain / application / infra / apps
- [ ] 驗收:併發兌換不超扣、大批量單一任務、斷點續跑、來源防重複、多 worker
- [ ] 發送排程器(monorepo 內獨立 app,另立計畫文件)
