use async_trait::async_trait;
use point_center_ledger_core::{GrantBatch, GrantStore, GrantStoreError};
use sqlx::{PgPool, Postgres, QueryBuilder};
use uuid::Uuid;

use crate::expiry_sql::push_expires_at;

/// [`GrantStore`] 的 PostgreSQL 實作:一塊 customer 於單一 tx 內批量入帳。
///
/// 防重複靠兩張表的來源唯一鍵 + `ON CONFLICT DO NOTHING`:同來源同客戶
/// 已入帳者自動跳過;回傳的入帳數即 `customer_points` 實際新增列數。
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

#[async_trait]
impl GrantStore for PgGrantStore {
    async fn grant_batch(&self, batch: &GrantBatch) -> Result<u64, GrantStoreError> {
        if batch.customer_ids.is_empty() {
            return Ok(0);
        }

        let effective_at = batch.window.effective_at();
        let expiry = batch.window.expiry();

        let mut tx = self.pool.begin().await.map_err(backend_error)?;

        // customer_points:一列一批,來源唯一鍵擋重複入帳。
        let mut points = QueryBuilder::<Postgres>::new(
            "INSERT INTO customer_points \
             (customer_point_id, shop_id, customer_id, original_amount, remaining_amount, \
              effective_at, expires_at, issuance_id, author, source_id) ",
        );
        points.push_values(&batch.customer_ids, |mut row, &customer_id| {
            row.push_bind(Uuid::now_v7())
                .push_bind(batch.shop_id)
                .push_bind(customer_id)
                .push_bind(batch.amount_per_recipient)
                .push_bind(batch.amount_per_recipient)
                .push_bind(effective_at);
            push_expires_at(&mut row, expiry);
            row.push_bind(batch.issuance_id)
                .push_bind(&batch.author)
                .push_bind(&batch.source_id);
        });
        points.push(" ON CONFLICT (shop_id, author, source_id, customer_id) DO NOTHING");
        let granted = points
            .build()
            .execute(&mut *tx)
            .await
            .map_err(backend_error)?
            .rows_affected();

        // point_transactions:grant(+),來源唯一鍵擋重複留痕,與上表同進退。
        let mut transactions = QueryBuilder::<Postgres>::new(
            "INSERT INTO point_transactions \
             (transaction_id, shop_id, customer_id, transaction_type, amount_change, author, source_id) ",
        );
        transactions.push_values(&batch.customer_ids, |mut row, &customer_id| {
            row.push_bind(Uuid::now_v7())
                .push_bind(batch.shop_id)
                .push_bind(customer_id)
                .push_bind("grant")
                .push_bind(batch.amount_per_recipient)
                .push_bind(&batch.author)
                .push_bind(&batch.source_id);
        });
        transactions.push(
            " ON CONFLICT (shop_id, customer_id, author, source_id, transaction_type) DO NOTHING",
        );
        transactions
            .build()
            .execute(&mut *tx)
            .await
            .map_err(backend_error)?;

        tx.commit().await.map_err(backend_error)?;
        Ok(granted)
    }
}
