# 內部設計

> Domain 規則、DB、任務管線、觀測要求。架構佈局見 tech/02。

## Domain

### 聚合

| 聚合 | component | 職責 | 關鍵純函式(單測密集區) |
|------|-----------|------|------------------------|
| **Issuance** | issuance | 發點紀錄、狀態機 | 狀態轉移合法性;生效/到期換算 |
| **CustomerPoints** | ledger | 客戶的批次集合 | **FIFO 分攤**(Domain Service) |
| **Redemption** | ledger | 兌換紀錄、狀態機(預留→確認/取消) | 狀態轉移合法性 |
| **PointTransaction** | ledger | 交易留痕 | 不變量:`amount_change` 正負 ↔ 類型 |

### 領域規則

1. 點數只有絕對時間窗 `[生效, 到期)`:發點當下換算、整批一致;兩端查詢級瞬間生效。永久點無到期端(DB 為 `'infinity'`,`expires_at > now()` 恆真——所有查詢零特判)。
2. 一次發點是一個整體:批量連續處理,不逐人排隊。
3. 來源防重複:同 `(author, source_id)` 同客戶一生入帳一次。
4. 兌換兩階段:**預留**按生效窗先到期先扣、跨批分攤,即時扣減 `remaining_amount`(不足整筆拒絕);**確認**定案不可逆;**取消**以反向交易補回原批。即時兌換 = 預留即確認。
5. 餘額 = 生效窗內 `remaining_amount` 總和,即時計算。
6. 重複請求回首次結果,非錯誤。
7. component core 不依賴 tokio/sqlx/NATS(編譯期強制);規則全是純函式。
8. **租戶隔離**:一切資源隸屬 shop;查詢與唯一鍵一律以 `shop_id` 起頭,跨 shop 互不可見。

### Use Cases(CQRS)

Command 走 domain + tx;Query 直投影、無鎖無交易。

| Command | component | 對應 | 編排 |
|---------|-----------|------|------|
| `CreateIssuance` | issuance | UC-1 ① | 驗證 → 換算 → insert |
| `StartRecipientsUpload` | issuance | UC-1 ② | 狀態檢查 → 新 `upload_id`、作廢舊 parts |
| `UploadRecipients` | issuance | UC-1 ② | Range 檢核 → 接斷行、逐行驗證 → append → 前推計數 |
| `IssueIssuance` | issuance | UC-1 ③ | 狀態轉移 → 發布任務 |
| `CancelIssuance` | issuance | UC-1 取消 | 狀態轉移(僅 draft)→ 記 `cancelled_at` |
| `ProcessIssuanceTask` | issuance | 合約 A | 串流讀清單 → 分塊呼叫 `GrantPoints` → 進度 → 終態 |
| `GrantPoints` | ledger | 合約 A | 防重複過濾 → 冪等批量入帳 |
| `ReserveRedemption` | ledger | UC-2 建立 | 重送查核 → FIFO 分攤 → 扣 `remaining` + redeem 交易(+ 鎖策略) |
| `ConfirmRedemption` | ledger | UC-2 確認 | 狀態轉移 reserved→confirmed(不動餘額) |
| `CancelRedemption` | ledger | UC-2 取消 | reserved→cancelled → release 補回原批 + tx 內發 `points.redemption.cancelled` 事件 |
| `ExpirePoints` | ledger | 合約 B | 過期批次歸零 + expire 交易 |

| Query | component | 對應 |
|-------|-----------|------|
| `GetCustomerPoints` | ledger | UC-3(餘額 = SQL SUM,窗過濾在查詢裡) |
| `ListTransactions` | ledger | UC-4 |
| `GetIssuance` | issuance | UC-5(draft 附上傳資訊) |

- 寫側 / 讀側 ports 分開。
- interactor 持交易邊界、不含商業規則(規則在純函式)。
- v1 邏輯 CQRS(共用 PG);物理分離列 v2。

## DB

- 清單本體不落 PG:存名單儲存,PG 只存 URI 與計數。
- 自產 ID 一律 UUID v7(時間有序,批量插入索引順序寫)。
- `source_id` 為呼叫端字串,不在 UUID 規範內。

```sql
-- 發點紀錄(兼入帳進度追蹤)
CREATE TABLE point_issuances (
    issuance_id           UUID PRIMARY KEY,
    shop_id               UUID NOT NULL,             -- 租戶,外部核發
    author                TEXT NOT NULL,
    source_id             TEXT NOT NULL,
    amount_per_recipient  BIGINT NOT NULL CHECK (amount_per_recipient > 0),
    effective_at          TIMESTAMPTZ NOT NULL,
    expires_at            TIMESTAMPTZ NOT NULL,  -- 永久 = 'infinity'
    recipients_uri        TEXT,                      -- 清單快照 URI(file:// | gs://,不可變)
    recipient_count       INT,
    upload_id             UUID,                      -- 現行上傳 session;開新即換
    uploaded_count        INT NOT NULL DEFAULT 0,    -- 已持久化完整行數
    uploaded_bytes        BIGINT NOT NULL DEFAULT 0, -- 續傳 Range 的真相來源
    processed_count       INT NOT NULL DEFAULT 0,
    granted_count         INT NOT NULL DEFAULT 0,    -- 防重複略過者不計入
    status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','pending','processing','completed','failed','cancelled')),
    failure_reason        JSONB,                     -- failed 時必填:{code, message, …} 與 API 錯誤同形
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    issued_at             TIMESTAMPTZ,               -- 首次 :issue 時間;draft/cancelled 為 NULL,重試不改寫
    completed_at          TIMESTAMPTZ,
    cancelled_at          TIMESTAMPTZ,               -- cancelled 時必填(軟刪時間)
    CHECK (effective_at < expires_at)
);
-- 同 shop 同來源同時最多一筆「活的」;取消(軟刪)後可重建修正版
CREATE UNIQUE INDEX uq_point_issuances_active_source
    ON point_issuances (shop_id, author, source_id)
    WHERE status <> 'cancelled';

-- 客戶點數(一列一批)
CREATE TABLE customer_points (
    customer_point_id UUID PRIMARY KEY,
    shop_id           UUID NOT NULL,
    customer_id       UUID NOT NULL,
    original_amount   BIGINT NOT NULL CHECK (original_amount > 0),
    remaining_amount  BIGINT NOT NULL CHECK (remaining_amount >= 0),
    effective_at      TIMESTAMPTZ NOT NULL,
    expires_at        TIMESTAMPTZ NOT NULL,      -- 永久 = 'infinity'(PG 原生值,查詢/排序零特判)
    issuance_id       UUID NOT NULL REFERENCES point_issuances (issuance_id),
    author            TEXT NOT NULL,
    source_id         TEXT NOT NULL,
    granted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shop_id, author, source_id, customer_id) -- 防重複:同 shop 同來源同客戶一生一次
);
CREATE INDEX idx_customer_points_active ON customer_points (shop_id, customer_id, expires_at);
CREATE INDEX idx_customer_points_expirable                     -- 到期掃描專用
    ON customer_points (expires_at) WHERE remaining_amount > 0;

-- 交易紀錄
CREATE TABLE point_transactions (
    transaction_id     UUID PRIMARY KEY,
    shop_id            UUID NOT NULL,
    customer_id        UUID NOT NULL,
    transaction_type   TEXT NOT NULL CHECK (transaction_type IN ('grant','redeem','release','expire','adjust')),
    amount_change      BIGINT NOT NULL,              -- 發點/取消釋放正、兌換/到期負
    author             TEXT NOT NULL,                -- 到期 = 'system'
    source_id          TEXT NOT NULL,                -- 到期 = 過期批次 ID;兌換 = redemption 的來源
    occurred_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shop_id, customer_id, author, source_id, transaction_type) -- 來源即冪等:每來源每類型至多一筆
);
CREATE INDEX idx_point_transactions_customer ON point_transactions (shop_id, customer_id, occurred_at DESC);

-- 兌換(有狀態聚合:預留 → 確認 / 取消)
CREATE TABLE redemptions (
    redemption_id     UUID PRIMARY KEY,
    shop_id           UUID NOT NULL,
    customer_id       UUID NOT NULL,
    author            TEXT NOT NULL,
    source_id         TEXT NOT NULL,
    amount            BIGINT NOT NULL CHECK (amount > 0),
    status            TEXT NOT NULL DEFAULT 'reserved'
                      CHECK (status IN ('reserved','confirmed','cancelled')),
    reserved_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    hold_expires_at   TIMESTAMPTZ,               -- 預留逾時界限;即時兌換(建立即確認)為 NULL
    confirmed_at      TIMESTAMPTZ,               -- confirmed 必填
    cancelled_at      TIMESTAMPTZ,               -- cancelled 必填(軟刪語意)
    CHECK ((confirmed_at IS NOT NULL) = (status = 'confirmed')),
    CHECK ((cancelled_at IS NOT NULL) = (status = 'cancelled'))
);
-- 同 shop 同客戶同來源同時最多一筆「活的」;取消後同訂單可重來
CREATE UNIQUE INDEX uq_redemptions_active_source
    ON redemptions (shop_id, customer_id, author, source_id)
    WHERE status <> 'cancelled';
CREATE INDEX idx_redemptions_hold_expiring                     -- 逾時預留掃描
    ON redemptions (hold_expires_at) WHERE status = 'reserved';

-- 兌換扣減明細(redemption 的子表;一列 = 從哪筆點數扣多少,與預留同 tx 寫入)
CREATE TABLE redemption_deductions (
    redemption_id     UUID NOT NULL REFERENCES redemptions (redemption_id),
    customer_point_id UUID NOT NULL REFERENCES customer_points (customer_point_id),
    amount            BIGINT NOT NULL CHECK (amount > 0),
    PRIMARY KEY (redemption_id, customer_point_id)
);
CREATE INDEX idx_redemption_deductions_point ON redemption_deductions (customer_point_id); -- 批次守恆/反查用
```

兩個 UNIQUE 是冪等的最後防線;寫入一律 `ON CONFLICT DO NOTHING`。

**批次守恆(對帳不變量)**:`original_amount = remaining_amount + Σ(未取消 redemption 的 redemption_deductions.amount) + 到期額(expire 交易,source_id = 批次 ID)`——取消的預留其扣減已由 release 交易補回 `remaining`,故只計 `status <> 'cancelled'` 者;ops 腳本離峰驗證。

**兌換三結局在帳本**:`reserved` 與 `confirmed` 都只有一筆 `redeem`——confirm **不寫新交易**(點在預留時已扣,確認只轉狀態、不動餘額);`cancelled` 另有一筆 `release` 沖回、淨零。兩者在帳本上相同,差別只在 `redemptions.status`——成功與否看 status,不看帳本。

**餘額查詢**:

```sql
SELECT COALESCE(SUM(remaining_amount), 0) FROM customer_points
 WHERE shop_id = $1 AND customer_id = $2
   AND effective_at <= now() AND expires_at > now() AND remaining_amount > 0;
```

### 防超扣:兩種兌換策略

防超扣發生在**預留**階段(扣 `remaining`);確認只轉狀態、取消寫 release 補回,皆輕量無鎖競爭。`REDEEM_STRATEGY=pessimistic|optimistic` 切換,壓測對比。

**A 悲觀鎖(預設)**

- `SELECT … FOR UPDATE`,生效窗內、依 `expires_at, customer_point_id` 排序。
- 鎖序固定 → 同客戶併發自然排隊,不死鎖。
- 應用層總額檢查 + FIFO 分攤 → 逐批 UPDATE remaining + INSERT redemption(reserved)/ deductions / redeem 交易 → COMMIT。
- 併發發點的新批次不在快照內:只會少扣,不會超扣。

**B 樂觀條件式更新**

- 不鎖;逐批 `UPDATE … SET remaining = remaining - $take WHERE remaining >= $take`。
- 應用層驗證實際扣除總額;不足 → ROLLBACK 重試(上限 N 次)。
- 壓測觀察點:低競爭 B 快;熱點客戶下 B 的重試風暴 vs A 的鎖等待。

### 防重複的三層

1. 名單源頭過濾(v2)。
2. worker 串流 anti-join 過濾:省無效寫入,`granted_count` 乾淨。
3. DB 唯一鍵兜底:吸收 chunk 併發、重投的 race。

## 任務管線(NATS JetStream)

```
:issue ──▶ IssuanceTaskV1 ──▶ [Stream POINTS(points.>)] ──▶ durable pull consumer(competing)
                清單走名單儲存(JSONL part 檔),不塞訊息(避開 1MB 上限)
```

**任務**

- 一次發點 = 一個任務;訊息只帶 metadata(shopId、issuanceId、來源、金額、時間窗、URI、count)。

**批內處理**

- 串流讀 JSONL,記憶體 O(chunk)。
- 每 `WORKER_CHUNK_SIZE`(預設 1000)一塊:防重複過濾 → 單 tx 兩表批量 INSERT → 更新進度。
- 塊級並發 `WORKER_CONCURRENCY`(預設 4)。

**Ack 策略**

- explicit ack;處理中定期 `AckKind::Progress` 保活;完成才 ack。
- 崩潰 → 心跳消失 → ack_wait 逾時重投(恢復上限 ≈ ack_wait)。
- 暫時錯誤 → 不 ack,重投續跑。
- 永久錯誤 / `max_deliver` 耗盡 → 標 `failed` 後 ack。
- 任何路徑不留殭屍 `processing`。
- SIGTERM = graceful:停接新任務、在途不 ack。

**上傳落地**

- 分片(預設 10,000 行)寫 part 檔:`{issuance_id}/{upload_id}/part-NNNNN`。
- 落地成功才前推 `uploaded_count` / `uploaded_bytes`——計數永遠是已持久化的連續前綴。
- 跨塊半行不落地,由重送接合。
- 開新 session = 新 `upload_id` 新目錄;舊目錄保留(軟刪,不再引用),物理清理列 v2。

**到期任務(ExpirePoints,expiry-job)**

- 獨立執行檔,**run-to-completion**(清掃到無過期批次即退出);排程外部化——dev 手動 `make expiry-job`,prod = Cloud Scheduler → Cloud Run Job(節奏預設 1h)。
- 餘額正確性不依賴它(查詢級到期),它補交易留痕 + 發事件。
- 永久點(`expires_at = 'infinity'`)不滿足 `expires_at <= now()`,天然不進掃描、無到期事件。
- 重疊執行互斥:PG advisory lock,搶到才跑;冪等(交易 UNIQUE)兜底,鎖只省重工。
- 分塊處理(同批同時到期可達千萬列),每塊在一個**互動式 tx** 內:
  1. 掃描(走 `idx_customer_points_expirable`),讀歸零前 remaining。
  2. `BEGIN` → 寫 expire 交易 + 歸零(未提交)。
  3. 發布 `points.batch.expired.{author}`(每批次一則,`BatchExpiredV1`)。
  4. 發布成功才 `COMMIT`;失敗 → `ROLLBACK`,下輪重掃。
- 不丟事件:commit 前任何失敗都回滾 → 批次仍 `remaining > 0` → 下輪重掃重發。
- 仍是 at-least-once(發布成功但 commit 失敗 → 重發):訂閱方以 `customerPointId` 去重。
- 持 tx 發布的網路 I/O 在此無害:過期批次無人競爭(不可兌換 + advisory lock 單跑者)。
- prod 可改 Cloud Scheduler 觸發(Cloud Run job),v1 = worker 內建計時器。

**逾時預留取消(CancelExpiredHolds,hold-timeout-job)**

- 獨立高頻執行檔,與到期清掃分開跑:節奏分鐘級(`HOLD_SWEEP_INTERVAL` 預設 60s),到期清掃是小時級——兩者頻率差一個數量級,不共用 job。
- `hold_expires_at = reserved_at + holdTtlSeconds`;`holdTtlSeconds` 呼叫端傳,預設 900(15 分鐘),範圍 60–7200;immediate 兌換不設(NULL,不逾時)。
- 掃 `idx_redemptions_hold_expiring`(`status = 'reserved' AND hold_expires_at <= now()`),每筆走 `CancelRedemption`:reserved→cancelled + release 補回原批 + tx 內發 `points.redemption.cancelled`(`reason=timeout`)。與主動取消同路徑、冪等;逾時由系統自主發起、呼叫端不知情,此事件是唯一回報路徑(→ 訂單中心 → 通知中心告知客戶)。
- 被迫取消時間 = TTL + 最多一個掃描週期(≤ 60s)。主動取消(金流回調,秒級)是常態,此為兜底,避免棄單永久凍結餘額。
- 重疊執行以 advisory lock 互斥;冪等(狀態機 + UNIQUE)兜底。

**其他**

- 名單儲存 = `RecipientListStore` port:v1 `file://` → 正式 `gs://`。
- 終態事件:先落 DB 再發;訂閱方以 `issuanceId` 去重。
- 事件 payload 與消費合約見 api.md「NATS 事件」;stream 保留 = limits(時間/大小,實作時定)。
- 多實例:多開 `make grant-worker`;容器化後 `--scale grant-worker=N`。

## 觀測要求

- 結構化欄位全程必帶:`request_id`、`customer_id`、`issuance_id`、`author`、`source_id`、`amount`、`elapsed_ms`、JetStream `sequence`。
- API:TraceLayer(span 含 `request_id`);panic 由 CatchPanicLayer 收斂為 `500`。
- worker:任務起訖 info log;每塊 debug log;失敗必留 error log。
- use case 層 `#[tracing::instrument]` 建 span。
- OTLP:設 `OTEL_EXPORTER_OTLP_ENDPOINT` 才啟用;`service.name = {context}-{app}`。
- trace 跨 NATS:發布塞 `traceparent`;worker 開新 trace 以 span link 指回。
- 業務指標:core 以 `monotonic_counter.*` / `histogram.*` 事件發出,shell 橋接;高基數識別碼永不進 label。
