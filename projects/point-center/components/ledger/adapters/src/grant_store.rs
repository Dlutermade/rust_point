use async_trait::async_trait;
use point_center_ledger_core::{GrantBatch, GrantStore, GrantStoreError};
use sqlx::PgPool;
use uuid::Uuid;

use crate::expiry_sql::expires_bind;

/// [`GrantStore`] 的 PostgreSQL 實作:一塊 customer 於單一 tx 內批量入帳。
///
/// 防重複靠兩張表的來源唯一鍵 + `ON CONFLICT DO NOTHING`:同來源同客戶
/// 已入帳者自動跳過;回傳的入帳數即 `customer_points` 實際新增列數。
/// SQL 在 `sql/*.sql`,以 `query_file!` 編譯期對 schema 檢查。
pub struct PgGrantStore {
    pool: PgPool,
}

impl PgGrantStore {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn backend_error(error: sqlx::Error) -> GrantStoreError {
    GrantStoreError::Backend(error.to_string())
}

/// 產 n 個 UUID v7(應用側產 ID;時間有序,批量插入索引順序寫)。
fn new_ids(n: usize) -> Vec<Uuid> {
    (0..n).map(|_| Uuid::now_v7()).collect()
}

#[async_trait]
impl GrantStore for PgGrantStore {
    async fn grant_batch(&self, batch: &GrantBatch) -> Result<u64, GrantStoreError> {
        if batch.customer_ids.is_empty() {
            return Ok(0);
        }

        let point_ids = new_ids(batch.customer_ids.len());
        let transaction_ids = new_ids(batch.customer_ids.len());
        let expires_at = expires_bind(batch.window.expiry());

        let mut tx = self.pool.begin().await.map_err(backend_error)?;

        // customer_points:一列一批,來源唯一鍵擋重複入帳。
        let granted = sqlx::query_file!(
            "sql/grant_insert_points.sql",
            batch.shop_id,
            batch.amount_per_recipient,
            batch.window.effective_at(),
            expires_at,
            batch.issuance_id,
            batch.author,
            batch.source_id,
            &point_ids,
            &batch.customer_ids,
        )
        .execute(&mut *tx)
        .await
        .map_err(backend_error)?
        .rows_affected();

        // point_transactions:grant(+),來源唯一鍵擋重複留痕,與上表同進退。
        sqlx::query_file!(
            "sql/grant_insert_transactions.sql",
            batch.shop_id,
            batch.amount_per_recipient,
            batch.author,
            batch.source_id,
            &transaction_ids,
            &batch.customer_ids,
        )
        .execute(&mut *tx)
        .await
        .map_err(backend_error)?;

        tx.commit().await.map_err(backend_error)?;
        Ok(granted)
    }
}
