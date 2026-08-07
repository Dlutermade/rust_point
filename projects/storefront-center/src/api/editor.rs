//! 編輯 API(商家後台):三個實體各一組路由 —— 首頁模板 / 頁首模板 / 頁尾模板。
//!
//! **不吃「版位」參數**。三者能做的事本來就不同:只有首頁有優先序與外框覆寫,
//! 只有頁首 / 頁尾有站台預設。admin 前端本來就是三個獨立門面。
//!
//! 輸出 JSON 一律 camelCase,對上前端型別。
//! 多租戶解析仍是 stub(選店尚未接 DB),暫時全掛在 `DEFAULT_TENANT` 底下。

use axum::Json;
use axum::Router;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, patch, post, put};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{Value, json};
use time::OffsetDateTime;
use uuid::Uuid;

use super::AppState;
use crate::domain::{
    AuditAction, AuditEntry, FooterTemplate, HeaderTemplate, HomePageTemplate, TemplateStatus,
};
use crate::store::{DEFAULT_TENANT, FooterPatch, HeaderPatch, HomePagePatch, StoreError};

pub fn router() -> Router<AppState> {
    Router::new()
        // ── 首頁模板 ──
        .route("/home-pages", get(list_home_pages).post(create_home_page))
        .route(
            "/home-pages/{id}",
            get(get_home_page).delete(remove_home_page),
        )
        .route("/home-pages/{id}/draft", patch(save_home_page_draft))
        .route("/home-pages/{id}/publish", post(publish_home_page))
        .route("/home-pages/{id}/duplicate", post(duplicate_home_page))
        .route("/home-pages/{id}/priority", put(set_home_page_priority))
        .route("/home-pages/{id}/pause", post(pause_home_page))
        .route("/home-pages/{id}/resume", post(resume_home_page))
        .route("/home-pages/{id}/audit", get(home_page_audit))
        .route("/home-pages/{id}/content", get(home_page_content))
        // ── 頁首模板 ──
        .route("/headers", get(list_headers).post(create_header))
        .route("/headers/{id}", get(get_header).delete(remove_header))
        .route("/headers/{id}/draft", patch(save_header_draft))
        .route("/headers/{id}/publish", post(publish_header))
        .route("/headers/{id}/duplicate", post(duplicate_header))
        .route("/headers/{id}/pause", post(pause_header))
        .route("/headers/{id}/resume", post(resume_header))
        .route("/headers/{id}/site-default", post(set_header_site_default))
        .route("/headers/{id}/audit", get(header_audit))
        .route("/headers/{id}/content", get(header_content))
        // 站台預設頁首的內容(編輯器預覽首頁時湊外框用)。
        // 刻意不寫成 /headers/site-default/content —— 那會跟 /headers/{id}/content 撞。
        .route("/headers/site-default-content", get(site_default_header))
        // ── 頁尾模板 ──
        .route("/footers", get(list_footers).post(create_footer))
        .route("/footers/{id}", get(get_footer).delete(remove_footer))
        .route("/footers/{id}/draft", patch(save_footer_draft))
        .route("/footers/{id}/publish", post(publish_footer))
        .route("/footers/{id}/duplicate", post(duplicate_footer))
        .route("/footers/{id}/pause", post(pause_footer))
        .route("/footers/{id}/resume", post(resume_footer))
        .route("/footers/{id}/site-default", post(set_footer_site_default))
        .route("/footers/{id}/audit", get(footer_audit))
        .route("/footers/{id}/content", get(footer_content))
        .route("/footers/site-default-content", get(site_default_footer))
        // 未匹配的 /api/* 也回 JSON 錯誤體,跟其他錯誤同形(而不是空的 404)
        .fallback(not_found)
}

// ── 輸出 DTO(camelCase,對齊 admin 型別) ─────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HomePageSummary {
    id: Uuid,
    name: String,
    status: TemplateStatus,
    is_fallback: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    seo_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    seo_description: Option<String>,
    targeting: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    header_template_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    footer_template_id: Option<Uuid>,
    version: i64,
    updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    note: Option<String>,
}

impl From<&HomePageTemplate> for HomePageSummary {
    fn from(t: &HomePageTemplate) -> Self {
        Self {
            id: t.id,
            name: t.name.clone(),
            status: t.status,
            is_fallback: t.is_fallback,
            seo_title: t.seo_title.clone(),
            seo_description: t.seo_description.clone(),
            targeting: t.targeting.clone(),
            header_template_id: t.header_template_id,
            footer_template_id: t.footer_template_id,
            version: t.version,
            updated_at: rfc3339(t.updated_at),
            note: t.note.clone(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HomePageEntity {
    #[serde(flatten)]
    summary: HomePageSummary,
    content: Value,
}

impl From<&HomePageTemplate> for HomePageEntity {
    fn from(t: &HomePageTemplate) -> Self {
        Self {
            summary: t.into(),
            content: t.content.clone(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HeaderSummary {
    id: Uuid,
    name: String,
    status: TemplateStatus,
    is_site_default: bool,
    version: i64,
    updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    note: Option<String>,
}

impl From<&HeaderTemplate> for HeaderSummary {
    fn from(t: &HeaderTemplate) -> Self {
        Self {
            id: t.id,
            name: t.name.clone(),
            status: t.status,
            is_site_default: t.is_site_default,
            version: t.version,
            updated_at: rfc3339(t.updated_at),
            note: t.note.clone(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HeaderEntity {
    #[serde(flatten)]
    summary: HeaderSummary,
    content: Value,
}

impl From<&HeaderTemplate> for HeaderEntity {
    fn from(t: &HeaderTemplate) -> Self {
        Self {
            summary: t.into(),
            content: t.content.clone(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FooterSummary {
    id: Uuid,
    name: String,
    status: TemplateStatus,
    is_site_default: bool,
    version: i64,
    updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    note: Option<String>,
}

impl From<&FooterTemplate> for FooterSummary {
    fn from(t: &FooterTemplate) -> Self {
        Self {
            id: t.id,
            name: t.name.clone(),
            status: t.status,
            is_site_default: t.is_site_default,
            version: t.version,
            updated_at: rfc3339(t.updated_at),
            note: t.note.clone(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FooterEntity {
    #[serde(flatten)]
    summary: FooterSummary,
    content: Value,
}

impl From<&FooterTemplate> for FooterEntity {
    fn from(t: &FooterTemplate) -> Self {
        Self {
            summary: t.into(),
            content: t.content.clone(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuditDto {
    id: Uuid,
    template_id: Uuid,
    action: AuditAction,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
    at: String,
}

impl From<&AuditEntry> for AuditDto {
    fn from(a: &AuditEntry) -> Self {
        Self {
            id: a.id,
            template_id: a.template_id,
            action: a.action,
            detail: a.detail.clone(),
            at: rfc3339(a.at),
        }
    }
}

// ── 輸入 body ────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateBody {
    name: String,
}

/// 首頁模板的草稿 / 發布 body(兩者同形 —— 發布 = 套上最終欄位再轉 active)。
///
/// 可為 null 的欄位用 `Option<Option<T>>` + `double_option`:
/// 欄位沒出現 = 不動、給 `null` = 清空、給值 = 設值。
/// 「清空」對外框覆寫是有意義的操作:取消指定,改回跟隨站台預設。
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HomePageBody {
    name: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    seo_title: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    seo_description: Option<Option<String>>,
    targeting: Option<Value>,
    #[serde(default, deserialize_with = "double_option")]
    header_template_id: Option<Option<Uuid>>,
    #[serde(default, deserialize_with = "double_option")]
    footer_template_id: Option<Option<Uuid>>,
    content: Option<Value>,
}

impl From<HomePageBody> for HomePagePatch {
    fn from(b: HomePageBody) -> Self {
        Self {
            name: b.name,
            seo_title: b.seo_title,
            seo_description: b.seo_description,
            targeting: b.targeting,
            header_template_id: b.header_template_id,
            footer_template_id: b.footer_template_id,
            content: b.content,
        }
    }
}

#[derive(Deserialize)]
struct ChromeBody {
    name: Option<String>,
    content: Option<Value>,
}

#[derive(Deserialize)]
struct PriorityBody {
    priority: i64,
}

/// 讓 `Option<Option<T>>` 區分「欄位沒出現」與「明確給 null」——
/// serde 預設兩者都給 `None`,那樣就無法表達「清空這個欄位」。
fn double_option<'de, T, D>(de: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Option::deserialize(de).map(Some)
}

// ── handlers:首頁模板 ────────────────────────────────────────────────

async fn list_home_pages(
    State(app): State<AppState>,
) -> Result<Json<Vec<HomePageSummary>>, ApiError> {
    let rows = app.store.list_home_pages(DEFAULT_TENANT).await?;
    Ok(Json(rows.iter().map(HomePageSummary::from).collect()))
}

async fn create_home_page(
    State(app): State<AppState>,
    Json(body): Json<CreateBody>,
) -> Result<(StatusCode, Json<HomePageSummary>), ApiError> {
    let t = app
        .store
        .create_home_page_draft(DEFAULT_TENANT, body.name)
        .await?;
    Ok((StatusCode::CREATED, Json((&t).into())))
}

async fn get_home_page(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<HomePageEntity>, ApiError> {
    let t = app.store.get_home_page(DEFAULT_TENANT, id).await?;
    Ok(Json((&t).into()))
}

async fn save_home_page_draft(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<HomePageBody>,
) -> Result<Json<HomePageSummary>, ApiError> {
    let t = app
        .store
        .save_home_page_draft(DEFAULT_TENANT, id, body.into())
        .await?;
    Ok(Json((&t).into()))
}

async fn publish_home_page(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<HomePageBody>,
) -> Result<Json<HomePageSummary>, ApiError> {
    let t = app
        .store
        .publish_home_page(DEFAULT_TENANT, id, body.into())
        .await?;
    Ok(Json((&t).into()))
}

async fn duplicate_home_page(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(StatusCode, Json<HomePageSummary>), ApiError> {
    let t = app.store.duplicate_home_page(DEFAULT_TENANT, id).await?;
    Ok((StatusCode::CREATED, Json((&t).into())))
}

async fn set_home_page_priority(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<PriorityBody>,
) -> Result<Json<HomePageSummary>, ApiError> {
    let t = app
        .store
        .set_home_page_priority(DEFAULT_TENANT, id, body.priority)
        .await?;
    Ok(Json((&t).into()))
}

async fn pause_home_page(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<HomePageSummary>, ApiError> {
    let t = app
        .store
        .set_home_page_paused(DEFAULT_TENANT, id, true)
        .await?;
    Ok(Json((&t).into()))
}

async fn resume_home_page(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<HomePageSummary>, ApiError> {
    let t = app
        .store
        .set_home_page_paused(DEFAULT_TENANT, id, false)
        .await?;
    Ok(Json((&t).into()))
}

async fn remove_home_page(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    app.store.remove_home_page(DEFAULT_TENANT, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn home_page_audit(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<AuditDto>>, ApiError> {
    let rows = app.store.home_page_audit(DEFAULT_TENANT, id).await?;
    Ok(Json(rows.iter().map(AuditDto::from).collect()))
}

async fn home_page_content(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let t = app.store.get_home_page(DEFAULT_TENANT, id).await?;
    Ok(Json(t.content))
}

// ── handlers:頁首模板 ────────────────────────────────────────────────

async fn list_headers(State(app): State<AppState>) -> Result<Json<Vec<HeaderSummary>>, ApiError> {
    let rows = app.store.list_headers(DEFAULT_TENANT).await?;
    Ok(Json(rows.iter().map(HeaderSummary::from).collect()))
}

async fn create_header(
    State(app): State<AppState>,
    Json(body): Json<CreateBody>,
) -> Result<(StatusCode, Json<HeaderSummary>), ApiError> {
    let t = app
        .store
        .create_header_draft(DEFAULT_TENANT, body.name)
        .await?;
    Ok((StatusCode::CREATED, Json((&t).into())))
}

async fn get_header(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<HeaderEntity>, ApiError> {
    let t = app.store.get_header(DEFAULT_TENANT, id).await?;
    Ok(Json((&t).into()))
}

async fn save_header_draft(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<ChromeBody>,
) -> Result<Json<HeaderSummary>, ApiError> {
    let patch = HeaderPatch {
        name: body.name,
        content: body.content,
    };
    let t = app
        .store
        .save_header_draft(DEFAULT_TENANT, id, patch)
        .await?;
    Ok(Json((&t).into()))
}

async fn publish_header(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<ChromeBody>,
) -> Result<Json<HeaderSummary>, ApiError> {
    let patch = HeaderPatch {
        name: body.name,
        content: body.content,
    };
    let t = app.store.publish_header(DEFAULT_TENANT, id, patch).await?;
    Ok(Json((&t).into()))
}

async fn duplicate_header(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(StatusCode, Json<HeaderSummary>), ApiError> {
    let t = app.store.duplicate_header(DEFAULT_TENANT, id).await?;
    Ok((StatusCode::CREATED, Json((&t).into())))
}

async fn pause_header(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<HeaderSummary>, ApiError> {
    let t = app
        .store
        .set_header_paused(DEFAULT_TENANT, id, true)
        .await?;
    Ok(Json((&t).into()))
}

async fn resume_header(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<HeaderSummary>, ApiError> {
    let t = app
        .store
        .set_header_paused(DEFAULT_TENANT, id, false)
        .await?;
    Ok(Json((&t).into()))
}

async fn set_header_site_default(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<HeaderSummary>, ApiError> {
    let t = app
        .store
        .set_header_site_default(DEFAULT_TENANT, id)
        .await?;
    Ok(Json((&t).into()))
}

async fn remove_header(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    app.store.remove_header(DEFAULT_TENANT, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn header_audit(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<AuditDto>>, ApiError> {
    let rows = app.store.header_audit(DEFAULT_TENANT, id).await?;
    Ok(Json(rows.iter().map(AuditDto::from).collect()))
}

async fn header_content(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let t = app.store.get_header(DEFAULT_TENANT, id).await?;
    Ok(Json(t.content))
}

async fn site_default_header(State(app): State<AppState>) -> Result<Json<Value>, ApiError> {
    let content = app
        .store
        .site_default_header_content(DEFAULT_TENANT)
        .await?;
    Ok(Json(content))
}

// ── handlers:頁尾模板 ────────────────────────────────────────────────

async fn list_footers(State(app): State<AppState>) -> Result<Json<Vec<FooterSummary>>, ApiError> {
    let rows = app.store.list_footers(DEFAULT_TENANT).await?;
    Ok(Json(rows.iter().map(FooterSummary::from).collect()))
}

async fn create_footer(
    State(app): State<AppState>,
    Json(body): Json<CreateBody>,
) -> Result<(StatusCode, Json<FooterSummary>), ApiError> {
    let t = app
        .store
        .create_footer_draft(DEFAULT_TENANT, body.name)
        .await?;
    Ok((StatusCode::CREATED, Json((&t).into())))
}

async fn get_footer(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<FooterEntity>, ApiError> {
    let t = app.store.get_footer(DEFAULT_TENANT, id).await?;
    Ok(Json((&t).into()))
}

async fn save_footer_draft(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<ChromeBody>,
) -> Result<Json<FooterSummary>, ApiError> {
    let patch = FooterPatch {
        name: body.name,
        content: body.content,
    };
    let t = app
        .store
        .save_footer_draft(DEFAULT_TENANT, id, patch)
        .await?;
    Ok(Json((&t).into()))
}

async fn publish_footer(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<ChromeBody>,
) -> Result<Json<FooterSummary>, ApiError> {
    let patch = FooterPatch {
        name: body.name,
        content: body.content,
    };
    let t = app.store.publish_footer(DEFAULT_TENANT, id, patch).await?;
    Ok(Json((&t).into()))
}

async fn duplicate_footer(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(StatusCode, Json<FooterSummary>), ApiError> {
    let t = app.store.duplicate_footer(DEFAULT_TENANT, id).await?;
    Ok((StatusCode::CREATED, Json((&t).into())))
}

async fn pause_footer(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<FooterSummary>, ApiError> {
    let t = app
        .store
        .set_footer_paused(DEFAULT_TENANT, id, true)
        .await?;
    Ok(Json((&t).into()))
}

async fn resume_footer(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<FooterSummary>, ApiError> {
    let t = app
        .store
        .set_footer_paused(DEFAULT_TENANT, id, false)
        .await?;
    Ok(Json((&t).into()))
}

async fn set_footer_site_default(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<FooterSummary>, ApiError> {
    let t = app
        .store
        .set_footer_site_default(DEFAULT_TENANT, id)
        .await?;
    Ok(Json((&t).into()))
}

async fn remove_footer(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    app.store.remove_footer(DEFAULT_TENANT, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn footer_audit(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<AuditDto>>, ApiError> {
    let rows = app.store.footer_audit(DEFAULT_TENANT, id).await?;
    Ok(Json(rows.iter().map(AuditDto::from).collect()))
}

async fn footer_content(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let t = app.store.get_footer(DEFAULT_TENANT, id).await?;
    Ok(Json(t.content))
}

async fn site_default_footer(State(app): State<AppState>) -> Result<Json<Value>, ApiError> {
    let content = app
        .store
        .site_default_footer_content(DEFAULT_TENANT)
        .await?;
    Ok(Json(content))
}

// ── 輔助 ─────────────────────────────────────────────────────────────

async fn not_found() -> ApiError {
    ApiError(StoreError::NotFound)
}

fn rfc3339(t: OffsetDateTime) -> String {
    t.format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default()
}

/// 把 StoreError 對到 HTTP 狀態碼 + JSON 錯誤體。
struct ApiError(StoreError);

impl From<StoreError> for ApiError {
    fn from(e: StoreError) -> Self {
        ApiError(e)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (code, msg) = match &self.0 {
            StoreError::NotFound => (StatusCode::NOT_FOUND, self.0.to_string()),
            StoreError::Conflict(m) => (StatusCode::CONFLICT, m.clone()),
            StoreError::BadRequest(m) => (StatusCode::BAD_REQUEST, m.clone()),
        };
        (code, Json(json!({ "error": msg }))).into_response()
    }
}
