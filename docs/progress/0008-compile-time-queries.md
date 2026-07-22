# 0008 — 查詢改編譯期檢查(sqlx offline query_file!)

> 日期:2026-07-21。承接 0007。

## 狀態

- ledger adapter 的查詢從 runtime `query(&str)` 改為 `query_file!` + offline 編譯期檢查。
- `PgGrantStore` 行為不變,整合測試仍綠;離線建置(無 DB)可行、編譯期擋欄位/型別錯。
- 回改 tech/01 的 runtime 決定。

## 本階段決策(一行一決策)

| 決策 | 細節在 |
|------|--------|
| 回改 tech/01:查詢走 `query_file!` + offline 編譯期檢查(原 runtime `query` 放棄了編譯期驗證) | tech/01 資料庫 |
| 關鍵洞察:offline 模式「編譯期檢查」與「建置不依賴活 DB」**不互斥**——tech/01 當初當二選一是誤判 | tech/01 |
| 查詢存 `components/ledger/adapters/queries/*.sql`(獨立檔:高亮 + linter);`query_file!` 對 schema 驗欄位/型別 | grant_store.rs、queries/ |
| `.sqlx/`(workspace root)快取 check-in;建置讀快取、不需活 DB;`make prepare` 重產、CI `--check` 擋過期 | Makefile、.sqlx/ |
| dev/CI 需 sqlx-cli 0.9(對齊 sqlx 0.9,`.sqlx` 格式綁版本) | tech/01 |
| 少數表達不了的查詢(advisory lock 等)才落 runtime `query` | tech/01 |
| 觸發此決定:使用者(Drizzle 背景)指出 `query(const &str)` 是 runtime 檢查、非 compile-time | — |

## 驗證狀態(對真實 PG 18.4 / Podman)

- 帶 DATABASE_URL 編譯 → 對活 PG 編譯期檢查通過。
- `cargo sqlx prepare --workspace` 產 `.sqlx/`(兩條查詢);`SQLX_OFFLINE=true` + 無 DB → 建置/測試綠。
- **編譯期檢查有效**:`.sql` 欄位打錯 → `cargo build` 報 `column ... does not exist`,還原後綠。
- 整合測試 2/2、離線全 workspace 46 測、clippy `-D warnings`、fmt 全綠。

## 下一步

- 其餘 ledger adapters(`RedemptionStore` 兩鎖策略、`ExpiryStore`、`LedgerQueries`)沿用 `queries/*.sql` + `query_file!`;改任何查詢後 `make prepare` 重產快取。
- 再 issuance adapters → apps 組裝。
