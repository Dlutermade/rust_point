//! `PgGrantStore` 整合測試(對真實 PostgreSQL)。
//!
//! 需 `DATABASE_URL`(compose 的 point_center);未設則整檔跳過,
//! 讓無容器的機器 `cargo test` 仍綠。每個測試以獨立 `shop_id` 隔離,
//! 不互相汙染、免清理。

use chrono::{DateTime, Utc};
use point_center_ledger_adapters::PgGrantStore;
use point_center_ledger_core::{EffectiveWindow, Expiry, GrantBatch, GrantStore};
use sqlx::PgPool;
use uuid::Uuid;

async fn pool() -> Option<PgPool> {
    let database_url = std::env::var("DATABASE_URL").ok()?;
    let pool = point_center_db::connect(&database_url, 5)
        .await
        .expect("connect to test database");
    point_center_db::migrate(&pool)
        .await
        .expect("run migrations");
    Some(pool)
}

fn utc(rfc3339: &str) -> DateTime<Utc> {
    rfc3339.parse().expect("valid RFC 3339 timestamp")
}

fn window(expiry: Expiry) -> EffectiveWindow {
    EffectiveWindow::new(utc("2026-08-01T00:00:00Z"), expiry).expect("valid window")
}

/// 先建一筆已送出的發點紀錄——`customer_points.issuance_id` 的 FK 要它先存在
/// (真實情境:worker 是在已 issue 的 issuance 上入帳)。回其 `issuance_id`。
async fn seed_issuance(pool: &PgPool, shop_id: Uuid, source_id: &str, expiry: Expiry) -> Uuid {
    let issuance_id = Uuid::now_v7();
    let window = window(expiry);
    let mut query = sqlx::QueryBuilder::new(
        "INSERT INTO point_issuances \
         (issuance_id, shop_id, author, source_id, amount_per_recipient, \
          effective_at, expires_at, status) ",
    );
    query.push_values([()], |mut row, ()| {
        row.push_bind(issuance_id)
            .push_bind(shop_id)
            .push_bind("dispatcher")
            .push_bind(source_id)
            .push_bind(500_i64)
            .push_bind(window.effective_at());
        match window.expiry() {
            Expiry::On(expires_at) => {
                row.push_bind(expires_at);
            }
            Expiry::Never => {
                row.push("'infinity'::timestamptz");
            }
        }
        row.push_bind("processing");
    });
    query
        .build()
        .execute(pool)
        .await
        .expect("seed point_issuances");
    issuance_id
}

fn batch(
    shop_id: Uuid,
    issuance_id: Uuid,
    source_id: &str,
    customer_ids: Vec<Uuid>,
    expiry: Expiry,
) -> GrantBatch {
    GrantBatch {
        shop_id,
        issuance_id,
        author: "dispatcher".to_string(),
        source_id: source_id.to_string(),
        amount_per_recipient: 500,
        window: window(expiry),
        customer_ids,
    }
}

#[tokio::test]
async fn grants_a_batch_and_is_idempotent_on_the_source() {
    let Some(pool) = pool().await else {
        eprintln!("DATABASE_URL unset — skipping PG integration test");
        return;
    };
    let store = PgGrantStore::new(pool.clone());
    let shop_id = Uuid::now_v7();
    let expiry = Expiry::On(utc("2026-08-31T00:00:00Z"));
    let issuance_id = seed_issuance(&pool, shop_id, "campaign-A", expiry).await;
    let customers = vec![Uuid::now_v7(), Uuid::now_v7(), Uuid::now_v7()];

    // given / when:首次對三人發點
    let granted = store
        .grant_batch(&batch(
            shop_id,
            issuance_id,
            "campaign-A",
            customers.clone(),
            expiry,
        ))
        .await
        .expect("grant batch");

    // then:三人入帳,customer_points 與 grant 交易各三列
    assert_eq!(granted, 3);
    assert_eq!(count_points(&pool, shop_id).await, 3);
    assert_eq!(count_grant_transactions(&pool, shop_id).await, 3);

    // when:同來源同名單再發一次(重投 / 重試),共用同一 issuance
    let regranted = store
        .grant_batch(&batch(
            shop_id,
            issuance_id,
            "campaign-A",
            customers,
            expiry,
        ))
        .await
        .expect("re-grant batch");

    // then:全數略過、無重複入帳
    assert_eq!(regranted, 0);
    assert_eq!(count_points(&pool, shop_id).await, 3);
    assert_eq!(count_grant_transactions(&pool, shop_id).await, 3);
}

#[tokio::test]
async fn permanent_points_store_expiry_as_infinity() {
    let Some(pool) = pool().await else {
        eprintln!("DATABASE_URL unset — skipping PG integration test");
        return;
    };
    let store = PgGrantStore::new(pool.clone());
    let shop_id = Uuid::now_v7();
    let issuance_id = seed_issuance(&pool, shop_id, "forever", Expiry::Never).await;

    // when:發永久點
    store
        .grant_batch(&batch(
            shop_id,
            issuance_id,
            "forever",
            vec![Uuid::now_v7()],
            Expiry::Never,
        ))
        .await
        .expect("grant permanent");

    // then:DB 端 expires_at = 'infinity',且 expires_at > now() 恆真
    let is_infinity: bool = sqlx::query_scalar(
        "SELECT expires_at = 'infinity' AND expires_at > now() \
         FROM customer_points WHERE shop_id = $1 LIMIT 1",
    )
    .bind(shop_id)
    .fetch_one(&pool)
    .await
    .expect("query permanent expiry");
    assert!(is_infinity);
}

async fn count_points(pool: &PgPool, shop_id: Uuid) -> i64 {
    sqlx::query_scalar("SELECT count(*) FROM customer_points WHERE shop_id = $1")
        .bind(shop_id)
        .fetch_one(pool)
        .await
        .expect("count customer_points")
}

async fn count_grant_transactions(pool: &PgPool, shop_id: Uuid) -> i64 {
    sqlx::query_scalar(
        "SELECT count(*) FROM point_transactions WHERE shop_id = $1 AND transaction_type = 'grant'",
    )
    .bind(shop_id)
    .fetch_one(pool)
    .await
    .expect("count grant transactions")
}
