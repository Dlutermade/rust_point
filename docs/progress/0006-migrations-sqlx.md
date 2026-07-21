# 0006 — Schema 遷移(sqlx 管理)

> 日期:2026-07-21。承接 0005。

## 狀態

- point-center schema 以 sqlx 管理:三個 migration 建立五張表,已對真實 PG(Podman)套用並驗證。
- 新增技術 plumbing crate `platform/db`;core 27 測 + 全 workspace 44 測仍綠。
- adapters 本體仍未動工(下一步)。

## 本階段決策(一行一決策;細節以右欄為準)

| 決策 | 細節在 |
|------|--------|
| migrator 歸屬:專案級技術 crate `platform/db`(`point-center-db`),持 PgPool + 內嵌 `sqlx::migrate!` + migrate binary | tech/02 §4b |
| 新分層 `platform/*` 收技術 plumbing(非業務);`components/` 維持純業務;workspace members 加此 glob | tech/02 §4b、Cargo.toml |
| migration = project 級(單一 `_sqlx_migrations` 序列):跨 component 表共存同一 DB(`customer_points → point_issuances` FK),非 component 級 | tech/02 §4b |
| migration 檔 `platform/db/migrations/NNNN_desc.sql`,序號版本;與 migrator 同 crate(`./migrations` 預設路徑) | platform/db |
| 拆三檔按 FK 依賴序:0001 issuances → 0002 ledger points → 0003 redemptions | migrations/ |
| dev 執行 = `make migrate`(cargo run migrate binary);prod = 部署 init step / Cloud Run Job;不裝 sqlx-cli(內嵌路線) | Makefile、tech/01「macros 只為 migrate!」 |
| **PostgreSQL 18 映像掛載點修正** = `/var/lib/postgresql`(舊 `/data` 被映像拒啟);compose bug,已修 | docker-compose.yml、tech/02 §4 |

## 驗證狀態(對真實 PG 18.4 / Podman)

- 三 migration 套用成功,`_sqlx_migrations` 記 v1/2/3 + checksum + 執行時間。
- 冪等重跑:零套用、無錯。
- **checksum 不可變保護**:改動已套用的 0001 → 重跑報 `migration 1 was previously applied but has been modified`;還原後恢復。
- DDL 不變量煙霧測試通過:永久點 `'infinity'`(`expires_at > now()` 恆真)、partial unique index 軟刪後可重建、redemption status↔時戳 CHECK、`effective_at < expires_at` CHECK。
- build / test 44 / clippy `-D warnings` / fmt / `cargo doc` 全綠。

## 下一步

- adapters:ledger PG(`GrantStore` 批量入帳、`RedemptionStore` 兩鎖策略、`ExpiryStore`/`LedgerQueries`)→ 名單儲存 `file://` → NATS(任務 + 事件);皆依賴 `platform/db` 的 `PgPool`。
- 整合驗收在 Mac(Podman)。
