//! 公開頁服務(訪客):M1 回 placeholder;渲染引擎於 M4 接上。

use axum::Router;
use axum::http::HeaderMap;
use axum::http::header::HOST;
use axum::response::Html;
use axum::routing::get;

use super::AppState;
use crate::tenant;

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(index))
    // M4:.route("/{*slug}", get(serve_page))
}

async fn index(headers: HeaderMap) -> Html<String> {
    let host = headers.get(HOST).and_then(|v| v.to_str().ok()).unwrap_or("");
    let tenant = tenant::resolve_from_host(host);
    Html(format!(
        "<!doctype html><meta charset=\"utf-8\"><title>storefront-center</title>\
         <h1>storefront-center (skeleton)</h1>\
         <p>host: {host}</p><p>tenant: {tenant:?}</p>"
    ))
}
