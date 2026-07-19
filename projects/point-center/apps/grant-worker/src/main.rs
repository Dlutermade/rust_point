//! point-center grant-worker shell — NATS pull consumer for the issuance
//! grant pipeline (ProcessIssuanceTask; competing consumers). Composition root.
//! Scaffold only — consumers land in the next iteration.

use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    tracing::info!("point-center grant-worker scaffold up; implementation starts next iteration");
    Ok(())
}
