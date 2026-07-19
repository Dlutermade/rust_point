//! point-center expiry-job shell — run-to-completion expiry sweep
//! (ExpirePoints; advisory lock against overlap). Scheduling is external:
//! manual in dev, Cloud Scheduler + Cloud Run Job in prod.
//! Scaffold only — the sweep lands in the next iteration.

use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    tracing::info!("point-center expiry-job scaffold up; implementation starts next iteration");
    Ok(())
}
