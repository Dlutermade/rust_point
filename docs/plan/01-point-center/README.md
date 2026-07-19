# 01 — 點數中心 v1

> 狀態:**待審查**
> 本篇:邊界、名詞、UC 總覽、驗收、不做。
> 合約細節 → [api.md](api.md);內部設計 → [internals.md](internals.md)。
> 選型 → tech/01;佈局 → tech/02;觀測 → tech/03。

## 邊界

**只做帳務**:發點入帳、兌換、餘額與到期、交易帳本。

- 「何時發、發給誰」屬未來的發送排程器(獨立 context)。
- 排程器與名單中心都是公開 API 的外部呼叫方,無特權通道。
- Customer 不在本系統管理,識別碼為外部核發的 UUID v7。
- **多租戶**:所有資源隸屬一個 shop;同一 customer 在不同 shop 的點數完全隔離。

```
┌─ 外部呼叫方 ────────────┐
│ 營運後台(人工)          │           ┌──────── 點數中心(本系統)────────┐
│ 發送排程器(未來 app)    │──公開 API──▶│ 發點入帳 │ 兌換 │ 餘額/到期 │ 帳本 │
│ 名單中心(推送 JSONL)    │           └──────────────────────────────────┘
└─────────────────────────┘
```

## 名詞

| 名詞 | 定義 |
|------|------|
| **shop_id** | 租戶(店家),外部核發的 UUID v7;一切資源與唯一鍵的第一把鑰匙 |
| **customer_id** | 外部核發的 UUID v7,不驗證存在性 |
| **points** | 領域概念名;數值欄位一律叫 **amount**(正整數) |
| **批次** | 一次入帳的一批點數,同批同生效/到期 |
| **balance** | 生效窗內批次的剩餘總和,即時計算 |
| **effectiveAt** | 開始可用時間;省略 = 發點當下 |
| **生效窗** | 點數僅在 **[生效, 到期)** 內可查入餘額、可兌換;永久點無到期端,生效後恆可用 |
| **到期方式** | 二選一:`expireOnDate` 指定時點;`expireNever` 永久。相對天數(自生效起 N 天)由呼叫端換算成絕對時點 |
| **對象清單** | 千萬級 JSONL(一行一個 `{"customerId": "<uuid>"}`),只走串流上傳 |
| **issuance** | 一次發點的紀錄與進度追蹤單位 |
| **author + sourceId** | 每筆異動必帶的來源(見下) |
| **redemption** | 扣減餘額;絕不超扣 |
| **FIFO 扣點** | 先扣最快到期批次,跨批分攤;永久點最後扣 |
| **transaction** | 異動留痕:grant(+)/ redeem(−)/ expire(−)/ adjust(±) |

**來源(author + sourceId)**:

- `author` = 誰:`manual`、`dispatcher`、`order-service`、`system`…(開放集合)。
- `sourceId` = 該來源下的識別碼:活動 ID、訂單號、過期批次 ID…。
- 一鍵三用:重送保護、防重複、溯源。
- 重複發放以不同 sourceId 表達(如「活動:期數」)。

**FIFO 例**:持有 A 300 點(8/1 到期)+ B 500 點(9/1 到期),兌 400 → A 扣 300、B 扣 100。

## Use Cases 總覽

角色:**營運人員**(後台)、**外部系統**(排程器、名單中心)、**客戶端應用**(代客戶)。

所有 API 以 `/shops/{shopId}` 為前綴(租戶範圍;表內省略)。

| UC | 名稱 | 角色 | API |
|----|------|------|-----|
| UC-1 | 發點 | 營運 / 外部系統 | `POST /issuances` → 開 session → `PUT` 傳塊 → `:issue` |
| UC-2 | 兌換 | 客戶端應用 | `POST /customers/{id}/redemptions` |
| UC-3 | 點數總覽 | 客戶端應用 | `GET /customers/{id}/points` |
| UC-4 | 交易紀錄 | 客戶端應用 / 營運 | `GET /customers/{id}/transactions` |
| UC-5 | 發點進度 | 營運 / 外部系統 | `GET /issuances/{id}` |
| UC-6 | 清單下載 | 營運 / 外部系統 | `GET /issuances/{id}/recipients` |

## 驗收條件(完成的定義)

1. `make up` 啟動 NATS + Postgres;四個 app 可各自啟動(`internal-api` / `storefront-api` / `grant-worker`,`expiry-job` 為單次執行)。
2. **發點全流程**:建立 → 開 session → 傳塊 → `:issue` → 入帳 → UC-3 餘額正確。傳塊案例含:
   - 單人清單
   - 中斷後查 `Range` 續傳
   - 非末塊非 256 KiB → `400`
   - 行跨塊斷開,server 接合
3. **大批量**:一次 ≥ 10 萬人,全數入帳、UC-5 進度可觀察(千萬級為設計目標)。
4. **斷點續跑**:處理中 `kill -9` worker → ack_wait 逾時重投 → 他機補完,無重複入帳。
5. **失敗與重做**:清單遺失 → `failed` + 原因、進度保留;重傳清單 → `:issue` 只補缺的人。
6. **來源唯一即冪等**:同來源同參數重送回 `200` 既有;異參數 `409`;下載行數 = `uploadedCount`。
7. **來源防重複**:同來源二次發點,已領者略過、未領照發;併發同來源亦不重複。
8. **生效窗**:三種到期方式換算正確;未生效不可用,生效即時可用;到期後餘額即時排除;`expire` 交易與 `points.batch.expired.{author}` 事件於週期內補上(可訂閱驗證);永久點恆可用、不進到期掃描、無到期事件。
9. **兌換重送保護**:同客戶同來源同參數回首次結果;異參數 `409`。
10. **併發兌換**:總額 > 餘額的併發下,最終餘額恰為 0;兩種策略皆過。
11. **多 grant-worker**:≥ 2 個 process 同時消費,無重複入帳;`expiry-job` 重疊執行被 advisory lock 擋下。
12. `cargo test` 通過(FIFO、換算、狀態轉移等純函式單測)。
13. **取消(軟刪)**:draft 取消 → `cancelled` + `cancelledAt`,紀錄保留;同來源可重建;非 draft 取消 → `409`;全系統無物理刪除。
14. **觀測**:起 `grafana/otel-lgtm` + 設 endpoint 後,`localhost:3000` 肉眼可見:
    - 兌換 = 單一 trace(含分段 span)
    - 發點全流程 = span link 相連的 traces
    - 指標:`granted_points_total` 爬升、兌換延遲直方圖(`strategy` label)、redelivery 計數
    - 未設 endpoint 時系統完全不受影響
15. **租戶隔離**:同一 customer 在兩個 shop 各自發點/兌換,餘額與交易互不可見、互不影響;同 `(author, sourceId)` 在不同 shop 不衝突。

## 本迭代不做

**移交發送排程器(未來獨立 context)**:

- 排程規則與引擎、`FOR UPDATE SKIP LOCKED` 認領
- 動態名單編排

**v2 候選**:

- 來源內已領查詢(供名單源頭過濾)
- 對帳:按來源/期間的交易匯出介面;交易增量 ETL 進 BigQuery(append-only + UUID v7 游標,免 CDC)
- 清單儲存接 GCS
- client 直傳 GCS(wire 已對齊;屆時行級驗證移至 `:issue`)
- CQRS 物理分離
- 轉讓 / 凍結 / 預扣 / 調整 API
- webhook、認證授權(服務呼叫端發憑證,綁定 shop)
- **public-api**(瀏覽器直達):客戶自查點數/交易(唯讀 UC-3/4 子集);前提 = 客戶身分認證 + CORS
- GCP 部署(api = Cloud Run service、worker = Cloud Run worker pool)與正式 CI

---

*審查通過後開工;完成後產出 `02-…` 進入下一迭代。*
