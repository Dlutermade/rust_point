//! Points center HTTP API (inbound adapter: Controller + Presenter).
//! Scaffold only — routes land in the next iteration.

use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    tracing::info!("points-center api scaffold up; implementation starts next iteration");
    Ok(())
}
