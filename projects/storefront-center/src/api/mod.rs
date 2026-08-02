//! 對外路由:公開頁服務(訪客)+ 編輯 API(商家後台)。

mod editor;
mod public;

use std::sync::Arc;

use axum::Router;
use axum::routing::get;

use crate::store::Store;

/// 共享狀態:資料存取藏在 `Store` port 後(現在是 InMemoryStore)。
#[derive(Clone)]
pub struct AppState {
    pub store: Arc<dyn Store>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .merge(public::router())
        .nest("/api", editor::router())
        .with_state(state)
}

async fn healthz() -> &'static str {
    "ok"
}
