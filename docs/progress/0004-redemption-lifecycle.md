# 0004 — 兌換預留生命週期(TCC)

> 日期:2026-07-20。承接 0003。

## 狀態

- 兌換從「無狀態同步操作」改為「有狀態聚合」:`reserved → confirmed / cancelled`(TCC 參與者)。
- 純 spec 改動,code 未動;ledger/issuance core 27 測仍綠。

## 本階段決策(一行一決策;細節以右欄為準)

| 決策 | 細節在 |
|------|--------|
| 兌換升為有狀態聚合:預留 → 確認 / 取消(結帳 Saga 的 TCC 參與者) | api.md UC-2 |
| `redemptions` 父表;`redemption_deductions` 改掛 `redemption_id` | internals DDL |
| 預留即扣 `remaining`(點當下已被訂單吃走);`deduct` 純函式不動 | internals、api UC-2 |
| settlement 二選一:`deferred`(兩階段)/ `immediate`(即時) | api.md UC-2 |
| 帳本忠實記錄(哲學 A):redeem/release 成對;**confirm 不寫交易**(不動餘額) | internals |
| 新增 `release` 交易(+);冪等鍵加 `transaction_type`(redeem/release 同源共存) | internals DDL |
| 對帳含 status 過濾:只計 `status <> 'cancelled'` 的扣減 | internals |
| 拆 `hold-timeout-job`(逾時預留,分鐘級)獨立於 `expiry-job`(到期,小時級) | internals、tech/02 |
| `holdTtlSeconds` 預設 900、範圍 60–7200;被迫取消 = TTL + ≤ 60s | internals |
| `points.redemption.cancelled` 事件入 v1(`reason` timeout/caller_cancelled),tx 內發布 | api.md 事件 |
| confirm 撞已逾時取消 → `409 redemption_already_cancelled`;訂單中心同源重建補償 | api.md UC-2 |
| Saga 責任劃分:點數中心給機制(409 + reason + 同源可重建),補償在 orchestrator | api.md 系統合約 C |

## 驗證狀態

- 純 spec 改動,無 code;`ledger`/`issuance` core 27 測未動、仍綠。
- sqlx 的 `redemptions` 往返、advisory lock、tx 內發布留待 adapter 階段整合測試。

## 下一步

- code:`TransactionType` 加 `Release`;`Redemption` 狀態機純函式(reserved→confirmed/cancelled 守衛)。
- 然後 ports → adapters → apps 組裝(含 `hold-timeout-job` scaffold);整合驗收在 Mac。
