use point_center_ledger_core::Expiry;
use sqlx::Postgres;
use sqlx::query_builder::Separated;

/// 把 [`Expiry`] 綁進一列 INSERT 的 `expires_at` 欄位。
///
/// chrono 無法表達 infinity,故永久點在此以 PG 字面 `'infinity'` 推入
/// (DB 端 `expires_at > now()` 恆真、查詢零特判,見 internals);
/// 有到期端則綁值。
pub fn push_expires_at(row: &mut Separated<'_, Postgres, &'static str>, expiry: Expiry) {
    match expiry {
        Expiry::On(expires_at) => {
            row.push_bind(expires_at);
        }
        Expiry::Never => {
            row.push("'infinity'::timestamptz");
        }
    }
}
