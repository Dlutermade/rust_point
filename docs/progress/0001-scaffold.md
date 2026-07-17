# 0001 — 進度紀錄:規格定案與 workspace 骨架

> 日期:2026-07-17
> 用途:交接 / 續跑。後續每次工作階段結束時,以新編號(`0002-…`)記錄進度,不回改舊文。

## 一、目前狀態(TL;DR)

**規格已定案(使用者審查通過)、workspace 骨架已建立且編譯測試全綠、尚未開始功能實作。**

- 已發布至 GitHub:`https://github.com/Dlutermade/rust_point`(main,HTTPS remote,gh CLI 認證)
- 骨架程式碼**尚未 commit**(使用者要求:**任何 commit 前必須先詢問**)

## 二、已完成

### 文件(皆經使用者逐輪審查定案)

| 文件 | 狀態 | 內容 |
|------|------|------|
| `docs/plan/01-points-center-spec.md` | **r18 定案** | 點數中心完整規格:名詞定義、UC-1〜UC-6 合約、系統合約 A/B、API 慣例、狀態圖與時序圖(mermaid)、Domain/DB 設計、任務管線、驗收條件 |
| `docs/tech/01-tech-stack.md` | **定案** | 技術選型與理由、替代方案、工程規約、版本錨點 |
| `README.md` | 已發布 | 專案概觀 |

### 程式碼骨架(本次新增,未 commit)

```
Cargo.toml                    # workspace(resolver 3, edition 2024;members 用 glob projects/*/crates|apps/*)
projects/points/              # bounded context「點數中心」——libs 與部署單元同一子樹
  crates/
    domain/                   # IssuanceStatus 狀態機(can_upload_recipients / issue)+ 2 個單測 ✅
    application/              # commands / queries / ports 模組佔位(doc 註解說明職責)
    infra/                    # 佔位(deps 已接線:sqlx、async-nats)
  apps/
    api/                      # points-api:tokio + tracing 啟動骨架(無路由)
    worker/                   # points-worker:tokio + tracing 啟動骨架(無 consumer)
docker-compose.yml            # NATS(-js)+ PostgreSQL 17(user/pass: app/app, db: points)
Makefile                      # up/down/api/worker/build/check/fmt/lint/test
```

**佈局決策(使用者選定)**:`projects/{context}/crates|apps` context 優先——一個 context 一顆子樹,未來排程器 = `projects/dispatch/…`;**context 之間禁止 Cargo 依賴**,只透過公開 HTTP API 與 NATS 事件溝通;crate 命名 `{context}-{名稱}`(`points-domain`、`points-api`)。

驗證:`cargo build --workspace` ✅(37s)、`cargo test --workspace` ✅(domain 2 tests)。

## 三、下一步(依序)

1. **domain**:`CustomerPoints` 批次 + **FIFO 分攤 Domain Service**(純函式,spec §2 有數字範例可直接當測資)、生效/到期換算(`expire_on_date` / `expire_after_days` 自生效起算)、`PointTransaction` 不變量。單測密集區。
2. **application**:outbound ports traits(`IssuanceRepository`、`CustomerPointsRepository`、`GrantTaskPublisher`、`RecipientListStore` 串流介面)→ commands(6 個)→ queries(3 個)。
3. **infra**:PG migrations(spec §5.1 DDL 直接可用)→ 兩種兌換策略(`REDEEM_STRATEGY` 切換)→ 檔案系統名單儲存(URI `file://`,分片 part 檔案)→ NATS 任務發布/消費 + 終態事件。
4. **apps**:api(Controller/Presenter、NDJSON 串流上傳含 `Upload-Offset` 續傳、`:issue` 自訂方法路由)→ worker(任務 consumer:串流讀清單、來源防重複過濾、分塊批量入帳、`AckKind::Progress`、失敗分流)。
5. **驗收**:spec §9 的 10+3 條,重點:併發兌換恰好歸零、10 萬人單一任務、`kill -9` 斷點續跑、來源防重複、多 worker 無重複入帳。

## 四、關鍵設計決策速查(實作時必守)

- **來源即冪等**:無 idempotencyKey;每筆異動帶 `(author, sourceId)`。issuance 來源唯一(同參數重送回 200 既有紀錄、異參數 409);兌換 `UNIQUE (customer_id, author, source_id)`;到期 `author='system'`。
- **一次發點 = 一個 NATS 任務**,名單走 JSONL part 檔案(`RecipientListStore`,v1 本機檔案系統、正式 GCS,URI `file://`/`gs://`)。**不用 NATS Object Store**(已否決)。
- **命名**:API camelCase / DB snake_case;數值欄位 amount 系(`originalAmount` / `remainingAmount` / `amount_change`);UUID 一律 **v7**。
- **狀態機**:`draft → pending → processing → completed | failed`;failed 可重新上傳清單 + `:issue` 重試;completed 唯一不可逆。
- **架構**:`apps → infra → application → domain`;CQRS(commands 走 domain+tx、queries 直投影);FIFO 分攤是 Domain Service;HTTP DTO 屬 Presentation(Controller/Presenter)。
- **headers 不帶業務資料**(`Upload-Offset` 為傳輸層語意,允許)。

## 五、流程約定(對交接者)

- **文件先審後做**:規格 `docs/plan/NN`、技術決策 `docs/tech/NN`、進度 `docs/progress/NNNN`;變更走新編號。
- **commit 前必須詢問使用者**,即使先前同一階段有推送過。
- 使用者是乾淨架構/六角架構愛好者,review 嚴格:UC 只寫合約不寫實作、spec 順序 = 名詞定義 → UC → domain → DB、必附狀態圖/時序圖。
- Claude 長期記憶(`~/.claude/projects/...-rust-test/memory/`)有完整偏好紀錄,交接給人類時以本文件與兩份 docs 為準。
