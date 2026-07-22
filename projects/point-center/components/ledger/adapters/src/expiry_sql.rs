use chrono::{DateTime, Utc};
use point_center_ledger_core::Expiry;

/// 寫入時把 [`Expiry`] 收成 nullable 綁定值:`On(ts)` → `Some(ts)`;
/// `Never` → `None`,SQL 端以 `COALESCE($n, 'infinity')` 落成永久。
///
/// chrono 表達不了 infinity,故永久點在 Rust 側一律走 `None`,
/// 只在 SQL 字面出現 `'infinity'`(DB 端 `expires_at > now()` 恆真)。
pub fn expires_bind(expiry: Expiry) -> Option<DateTime<Utc>> {
    match expiry {
        Expiry::On(expires_at) => Some(expires_at),
        Expiry::Never => None,
    }
}
