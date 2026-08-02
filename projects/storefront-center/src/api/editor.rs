//! 編輯 API(商家後台):頁面模板的 CRUD / 草稿 / 發布 / 狀態。
//!
//! 對齊 admin 前端契約(Model B)。輸出 JSON 一律 camelCase,對上前端型別。
//! 多租戶解析仍是 stub,暫時全掛在 `DEFAULT_TENANT` 底下。

use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, patch, post, put};
use axum::Router;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use time::OffsetDateTime;
use uuid::Uuid;

use super::AppState;
use crate::domain::{AuditAction, AuditEntry, Slot, Template, TemplateStatus};
use crate::store::{DEFAULT_TENANT, DraftPatch, PublishPatch, StoreError};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/slots/{slot}/templates", get(list).post(create))
        .route("/slots/{slot}/active-content", get(active_content))
        .route("/templates/{id}", get(get_one).delete(remove))
        .route("/templates/{id}/draft", patch(save_draft))
        .route("/templates/{id}/publish", post(publish))
        .route("/templates/{id}/pause", post(pause))
        .route("/templates/{id}/resume", post(resume))
        .route("/templates/{id}/priority", put(set_priority))
        .route("/templates/{id}/default", post(set_default))
        .route("/templates/{id}/audit", get(audit))
        .route("/templates/{id}/content", get(content))
}

// ── 輸出 DTO(camelCase,對齊 admin 型別) ─────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TemplateSummary {
    id: Uuid,
    slot: Slot,
    name: String,
    status: TemplateStatus,
    is_default: bool,
    targeting: Value,
    chrome: Value,
    version: i64,
    updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    note: Option<String>,
}

impl From<&Template> for TemplateSummary {
    fn from(t: &Template) -> Self {
        Self {
            id: t.id,
            slot: t.slot,
            name: t.name.clone(),
            status: t.status,
            is_default: t.is_default,
            targeting: t.targeting.clone(),
            chrome: t.chrome.clone(),
            version: t.version,
            updated_at: rfc3339(t.updated_at),
            note: t.note.clone(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TemplateEntity {
    #[serde(flatten)]
    summary: TemplateSummary,
    content: Value,
}

impl From<&Template> for TemplateEntity {
    fn from(t: &Template) -> Self {
        Self { summary: t.into(), content: t.content.clone() }
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

#[derive(Deserialize)]
struct DraftBody {
    name: Option<String>,
    content: Option<Value>,
    targeting: Option<Value>,
    chrome: Option<Value>,
}

#[derive(Deserialize)]
struct PublishBody {
    content: Option<Value>,
    targeting: Option<Value>,
}

#[derive(Deserialize)]
struct PriorityBody {
    priority: i64,
}

// ── handlers ─────────────────────────────────────────────────────────

async fn list(
    State(app): State<AppState>,
    Path(slot): Path<String>,
) -> Result<Json<Vec<TemplateSummary>>, ApiError> {
    let slot = parse_slot(&slot)?;
    let rows = app.store.list(DEFAULT_TENANT, slot).await?;
    Ok(Json(rows.iter().map(TemplateSummary::from).collect()))
}

async fn create(
    State(app): State<AppState>,
    Path(slot): Path<String>,
    Json(body): Json<CreateBody>,
) -> Result<(StatusCode, Json<TemplateSummary>), ApiError> {
    let slot = parse_slot(&slot)?;
    let t = app.store.create_draft(DEFAULT_TENANT, slot, body.name).await?;
    Ok((StatusCode::CREATED, Json((&t).into())))
}

async fn get_one(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TemplateEntity>, ApiError> {
    let t = app.store.get(DEFAULT_TENANT, id).await?;
    Ok(Json((&t).into()))
}

async fn save_draft(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<DraftBody>,
) -> Result<Json<TemplateSummary>, ApiError> {
    let patch = DraftPatch {
        name: body.name,
        content: body.content,
        targeting: body.targeting,
        chrome: body.chrome,
    };
    let t = app.store.save_draft(DEFAULT_TENANT, id, patch).await?;
    Ok(Json((&t).into()))
}

async fn publish(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<PublishBody>,
) -> Result<Json<TemplateSummary>, ApiError> {
    let patch = PublishPatch { content: body.content, targeting: body.targeting };
    let t = app.store.publish(DEFAULT_TENANT, id, patch).await?;
    Ok(Json((&t).into()))
}

async fn pause(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TemplateSummary>, ApiError> {
    let t = app.store.set_paused(DEFAULT_TENANT, id, true).await?;
    Ok(Json((&t).into()))
}

async fn resume(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TemplateSummary>, ApiError> {
    let t = app.store.set_paused(DEFAULT_TENANT, id, false).await?;
    Ok(Json((&t).into()))
}

async fn set_priority(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<PriorityBody>,
) -> Result<Json<TemplateSummary>, ApiError> {
    let t = app.store.set_priority(DEFAULT_TENANT, id, body.priority).await?;
    Ok(Json((&t).into()))
}

async fn set_default(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TemplateSummary>, ApiError> {
    let t = app.store.set_default(DEFAULT_TENANT, id).await?;
    Ok(Json((&t).into()))
}

async fn remove(State(app): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode, ApiError> {
    app.store.remove(DEFAULT_TENANT, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn audit(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<AuditDto>>, ApiError> {
    let rows = app.store.audit(DEFAULT_TENANT, id).await?;
    Ok(Json(rows.iter().map(AuditDto::from).collect()))
}

async fn content(
    State(app): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let t = app.store.get(DEFAULT_TENANT, id).await?;
    Ok(Json(t.content))
}

async fn active_content(
    State(app): State<AppState>,
    Path(slot): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let slot = parse_slot(&slot)?;
    let content = app.store.active_content(DEFAULT_TENANT, slot).await?;
    Ok(Json(content))
}

// ── 輔助 ─────────────────────────────────────────────────────────────

fn parse_slot(s: &str) -> Result<Slot, ApiError> {
    match s {
        "home" => Ok(Slot::Home),
        "header" => Ok(Slot::Header),
        "footer" => Ok(Slot::Footer),
        _ => Err(ApiError(StoreError::BadRequest(format!("未知版位:{s}")))),
    }
}

fn rfc3339(t: OffsetDateTime) -> String {
    t.format(&time::format_description::well_known::Rfc3339).unwrap_or_default()
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
