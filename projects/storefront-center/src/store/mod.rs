//! 資料存取 port(六角式)。API 層只依賴這個 trait;
//! 現在給 `InMemoryStore`,之後換 Postgres(sqlx)adapter 不動 API 層。
//!
//! trait 刻意 async:in-memory 實作雖同步,但 PG adapter 要 `.await` sqlx,
//! 介面先 async 才能無痛替換。

mod memory;

pub use memory::{DEFAULT_TENANT, InMemoryStore};

use async_trait::async_trait;
use serde_json::Value;
use uuid::Uuid;

use crate::domain::{AuditEntry, Slot, Template};

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("找不到模板")]
    NotFound,
    /// 違反狀態機 / 不可變性(如改已發布的模板、暫停常態版)。
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    BadRequest(String),
}

pub type StoreResult<T> = Result<T, StoreError>;

/// 存草稿的可選欄位(僅草稿可改)。給 None 的欄位不動。
#[derive(Debug, Default, Clone)]
pub struct DraftPatch {
    pub name: Option<String>,
    pub content: Option<Value>,
    pub targeting: Option<Value>,
    pub chrome: Option<Value>,
}

/// 發布時可一併帶上的最終內容 / 生效條件。
#[derive(Debug, Default, Clone)]
pub struct PublishPatch {
    pub content: Option<Value>,
    pub targeting: Option<Value>,
}

#[async_trait]
pub trait Store: Send + Sync {
    /// 某版位的所有模板(精簡投影由 API 層決定要不要帶 content)。
    async fn list(&self, tenant: Uuid, slot: Slot) -> StoreResult<Vec<Template>>;

    async fn get(&self, tenant: Uuid, id: Uuid) -> StoreResult<Template>;

    async fn create_draft(&self, tenant: Uuid, slot: Slot, name: String) -> StoreResult<Template>;

    /// 存草稿:僅 `draft` 狀態可改(已發布凍結)。
    async fn save_draft(&self, tenant: Uuid, id: Uuid, patch: DraftPatch) -> StoreResult<Template>;

    /// 發布:draft → active,套上最終內容,version + 1。
    async fn publish(&self, tenant: Uuid, id: Uuid, patch: PublishPatch) -> StoreResult<Template>;

    /// 就地調整優先序(寫入 targeting.priority)。
    async fn set_priority(&self, tenant: Uuid, id: Uuid, priority: i64) -> StoreResult<Template>;

    /// 暫停 / 恢復。常態版(is_default)不可暫停。
    async fn set_paused(&self, tenant: Uuid, id: Uuid, paused: bool) -> StoreResult<Template>;

    /// 設為站台預設(頁首 / 頁尾);同版位其餘的 is_default 取消。
    async fn set_default(&self, tenant: Uuid, id: Uuid) -> StoreResult<Template>;

    /// 刪除。常態版與 active 不可刪。
    async fn remove(&self, tenant: Uuid, id: Uuid) -> StoreResult<()>;

    async fn audit(&self, tenant: Uuid, id: Uuid) -> StoreResult<Vec<AuditEntry>>;

    /// 站台預設外框內容(resolveChrome):該版位取 is_default 的 active,
    /// 沒有就取第一個 active,回其 content;都沒有回空陣列。
    async fn active_content(&self, tenant: Uuid, slot: Slot) -> StoreResult<Value>;
}
