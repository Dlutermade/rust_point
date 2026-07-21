//! point-center 的資料庫 plumbing:`PgPool` 建構與 schema 遷移。
//!
//! 純技術基礎設施(非業務):`ledger` / `issuance` 的 adapters 依賴本 crate
//! 取得連線池,apps 的 composition root 於啟動時呼叫 [`migrate`]。
//! 一 DB 一 project——本 crate 與其 `migrations/` 是 point-center context
//! 唯一的 schema 真相來源。

use sqlx::PgPool;
use sqlx::migrate::{MigrateError, Migrator};
use sqlx::postgres::PgPoolOptions;

/// 內嵌 migrator:編譯期把 `migrations/` 打包進二進位,執行期對 pool 套用。
///
/// sqlx 以 `_sqlx_migrations` 表追蹤版本與 checksum(改動已套用的檔會被拒),
/// 並在遷移期取 advisory lock——多個 app / job 併發啟動也序列化安全。
pub static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// 建立連線池。`database_url` 與連線數由呼叫端(composition root)注入。
pub async fn connect(database_url: &str, max_connections: u32) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(max_connections)
        .connect(database_url)
        .await
}

/// 套用所有未套用的 migration;已套用者按 checksum 認出並跳過。
pub async fn migrate(pool: &PgPool) -> Result<(), MigrateError> {
    MIGRATOR.run(pool).await
}
