//! storefront-center — 可客製化的前台頁面系統(骨架)。
//!
//! M1:axum 骨架 + 設定 + 多租戶解析 + 路由分組(公開頁服務 / 編輯 API)。
//! 資料存取(M2)、渲染引擎(M4)、編輯器前端(M5)隨里程碑補上。

mod api;
mod config;
mod domain;
mod store;
mod tenant;

use std::sync::Arc;

use anyhow::Context;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

use crate::store::{InMemoryStore, Store};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing();

    let config = config::Config::from_env().context("load config")?;

    // M2:資料存取先用記憶體 store(不接 DB);之後換 Postgres adapter 不動 API 層。
    let store: Arc<dyn Store> = Arc::new(InMemoryStore::seeded());
    let state = api::AppState { store };

    let app = api::router(state).layer(tower_http::trace::TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(config.bind_addr)
        .await
        .with_context(|| format!("bind {}", config.bind_addr))?;
    tracing::info!(addr = %config.bind_addr, "storefront-center listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("server error")?;
    Ok(())
}

fn init_tracing() {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "info,storefront_center=debug".into());
    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer())
        .init();
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
    tracing::info!("shutting down");
}
