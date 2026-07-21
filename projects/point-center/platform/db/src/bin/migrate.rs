//! `make migrate`:對 `DATABASE_URL` 指向的資料庫套用遷移。
//!
//! 獨立於 apps——dev 手動跑,prod 由部署流程跑(Cloud Run Job / init step)。
//! 冪等:重跑只套用新增的 migration。

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let database_url =
        std::env::var("DATABASE_URL").map_err(|_| anyhow::anyhow!("DATABASE_URL is required"))?;

    let pool = point_center_db::connect(&database_url, 1).await?;
    point_center_db::migrate(&pool).await?;

    println!("migrations applied to {database_url}");
    Ok(())
}
