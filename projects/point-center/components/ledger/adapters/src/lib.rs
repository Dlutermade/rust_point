//! Ledger component — technology adapters.
//!
//! - PostgreSQL: chunked idempotent bulk grant (`ON CONFLICT DO NOTHING`),
//!   pessimistic / optimistic redeem strategies (`REDEEM_STRATEGY`),
//!   expiry sweep, read-side query adapters
//! - NATS: expiry events (`points.batch.expired`, versioned wire DTOs)
//!
//! 其餘 store 尚未實作,隨迭代補上。

mod expiry_sql;
mod grant_store;

pub use grant_store::PgGrantStore;
