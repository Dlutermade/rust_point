//! point-center internal-api shell — ops-facing delivery (issuance
//! lifecycle, progress, recipients). Controller + Presenter + composition root.
//! Scaffold only — routes land in the next iteration.

use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    tracing::info!("point-center internal-api scaffold up; implementation starts next iteration");
    Ok(())
}
