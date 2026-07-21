# 0007 — ledger adapter:PgGrantStore + 整合測試骨架

> 日期:2026-07-21。承接 0006。

## 狀態

- ledger 第一個 adapter `PgGrantStore`(批量入帳)完成,對真實 PG(Podman)驗證通過。
- 建立整合測試慣例(後續 store 沿用)。
- 全 workspace 46 測綠(純函式 44 + 整合 2);clippy `-D warnings` / fmt / `cargo doc` 零警告。

## 本階段決策(一行一決策)

| 決策 | 細節在 |
|------|--------|
| `PgGrantStore.grant_batch`:一塊於單一 tx 內 `QueryBuilder` 多列 INSERT 兩表,`ON CONFLICT DO NOTHING` 兜底防重複;回 `customer_points` 實際新增列數 | grant_store.rs |
| 永久點 expiry 綁定:`Never` 推 PG 字面 `'infinity'::timestamptz`、`On(ts)` 綁值(chrono 表達不了 infinity,在 adapter 邊界轉換) | expiry_sql.rs |
| 讀側 `'infinity'` → `Expiry::Never` 的還原留到讀側 adapter 才加(不留 dead code) | — |
| 整合測試:`DATABASE_URL` 未設則 early-return 跳過(無容器機器 `cargo test` 仍綠;`--nocapture` 印 skipping 可辨) | tests/grant_store.rs |
| 測試隔離:每案獨立 `shop_id`(UUID v7),不清理、不互汙;`seed_issuance` 先建父列滿足 `customer_points.issuance_id` FK | tests/grant_store.rs |
| adapters 的整合測試依賴 `platform/db`(dev-dependency)取 connect + migrator | adapters Cargo.toml |

## 驗證狀態(對真實 PG 18.4 / Podman)

- `grant_batch` 首次三人入帳 → `customer_points` 與 `grant` 交易各三列。
- 同來源重投 → 回 0、無重複入帳(來源唯一鍵兜底)。
- 永久點 → DB `expires_at = 'infinity'` 且 `expires_at > now()` 恆真。
- `DATABASE_URL` 未設 → 兩案皆印 skipping、`cargo test` 綠。

## 下一步

- ledger 其餘 adapters:`RedemptionStore`(兩鎖策略 reserve/confirm/cancel + tx 內發 cancelled 事件)、`ExpiryStore`(tx 級 advisory lock 分塊清掃)、`LedgerQueries`(讀側,含 `'infinity'` 還原)。
- 再 issuance adapters(repo、名單儲存 `file://`、NATS 任務/事件)→ apps 組裝。
