# 0005 — 兌換/發點聚合與 outbound ports

> 日期:2026-07-20。承接 0004。

## 狀態

- 0004 的 code 待辦完成:`TransactionType::Release`、`Redemption` 狀態機。
- `Issuance` 聚合完成(私有 status 收口、上傳 session 規則)。
- 兩個 component 的 outbound ports 定義完成;adapters 尚未動工。
- 44 單測全綠;clippy `-D warnings` / fmt / `cargo doc` 零警告。

## 本階段決策(一行一決策;細節以右欄為準)

| 決策 | 細節在 |
|------|--------|
| tx 邊界:port 方法 = 一個原子業務操作,tx 封裝於 adapter(不外洩、不長時);use case interactor 薄(驗證 → port → 映射) | internals「Use Cases」 |
| 清掃互斥 = **transaction-level advisory lock**(`pg_try_advisory_xact_lock`):隨 tx 自動釋放、連線池無孤兒鎖、拿不到立刻讓路;expiry 與 hold 兩把獨立 key | internals 到期/逾時小節 |
| `ExpiryStore` 無獨立取鎖方法:互斥進到每塊原子操作內,結局以 `SweepOutcome`(Swept / AnotherSweeperActive)表達 | ledger `ports.rs` |
| 鎖策略(pessimistic / optimistic)= 兩個 adapter 實作同一 `RedemptionStore`,composition root 依 `REDEEM_STRATEGY` 注入,不作方法參數 | ledger `ports.rs` |
| `grant_batch` 收 `GrantBatch`(塊共享 metadata + customer 清單),不逐列重複 | ledger `ports.rs` |
| restore 邊界嚴格化:`UploadSession` / `RecipientList` 為成對值物件,半缺不可表示;restore 為 passthrough,配對責任在 adapter | issuance `issuance.rs` |
| `:issue` 前置:清單須 finalize 且非空;`issued_at` 只記首次(重試不改寫);re-issue 清除 `failure_reason` | issuance `issuance.rs` |
| 開新上傳 session 即作廢舊清單快照(計數歸零);`advance` 位元組單調不可回退 | issuance `issuance.rs` |
| worker 消費迴圈不是 port:ack/保活屬 shell + adapter,use case 只回處理結局 | issuance `ports.rs` |
| 註解規約:rustdoc(intra-doc link、首句摘要、反引號);全名 use case interactor;**core 註解只講契約,不洩漏單一 adapter 實作**(PG 細節歸 internals 與 adapter) | tech/01 工程規約 |
| rustdoc 陷阱:intra-doc link 後緊接全形括號會被解析為 link destination;`cargo doc` 納入每輪檢查 | tech/01 工程規約 |

## 驗證狀態

- test 44/44(ledger 24 + issuance 20)/ clippy `-D warnings` / fmt / `cargo doc` 全綠。
- 本階段 commit:`07b102a`(Release + Redemption 狀態機)、`82dfa49`(Issuance 聚合)、ports(本次)。

## 下一步

- adapters:PG migrations(internals DDL)→ ledger PG(兩鎖策略、批量入帳、讀側)→ 名單儲存 `file://` → NATS(任務、事件)→ apps 組裝(含 `hold-timeout-job` scaffold)。
- 整合驗收在 Mac(Podman)。
