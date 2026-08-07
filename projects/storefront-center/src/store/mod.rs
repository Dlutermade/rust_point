//! 資料存取 port(六角式)。API 層只依賴這個 trait;
//! 現在給 `InMemoryStore`,之後換 Postgres(sqlx)adapter 不動 API 層。
//!
//! trait 刻意 async:in-memory 實作雖同步,但 PG adapter 要 `.await` sqlx,
//! 介面先 async 才能無痛替換。
//!
//! **三組方法,不吃「版位」參數**。首頁 / 頁首 / 頁尾是三個獨立實體,
//! 各自一組;能做的事本來就不同(只有首頁有優先序,只有頁首 / 頁尾有站台預設)。
//! 前端(admin)本來就是三個獨立門面,後端到這裡才對齊。
//! PG adapter 進場時,每個方法就是一句對單一張表的 SQL。

mod memory;
#[cfg(test)]
mod tests;

pub use memory::{DEFAULT_TENANT, InMemoryStore};

use async_trait::async_trait;
use serde_json::Value;
use uuid::Uuid;

use crate::domain::{AuditEntry, FooterTemplate, HeaderTemplate, HomePageTemplate};

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

// ── Patch ────────────────────────────────────────────────────────────────
//
// 草稿儲存與發布**吃同一個 patch**。發布 = 套上最終內容 + 轉 active,
// 沒有理由讓它能改的欄位比草稿少 —— 舊的 `PublishPatch` 只收 content / targeting,
// 逼得前端「發布」要先打一次 save-draft 再打 publish:不原子,而且每次發布
// 都灌一筆多餘的 save-draft 審計。
//
// 可為 NULL 的欄位用 `Option<Option<T>>`:
//   None             不動這個欄位
//   Some(None)       清成 NULL(例:取消外框覆寫,改回跟隨站台預設)
//   Some(Some(v))    設為 v

/// 首頁模板可改的欄位(僅草稿可改;發布時可一併帶上最終值)。
#[derive(Debug, Default, Clone)]
pub struct HomePagePatch {
    pub name: Option<String>,
    pub seo_title: Option<Option<String>>,
    pub seo_description: Option<Option<String>>,
    pub targeting: Option<Value>,
    pub header_template_id: Option<Option<Uuid>>,
    pub footer_template_id: Option<Option<Uuid>>,
    pub content: Option<Value>,
}

/// 頁首模板可改的欄位。沒有生效條件、沒有 SEO、沒有外框覆寫。
#[derive(Debug, Default, Clone)]
pub struct HeaderPatch {
    pub name: Option<String>,
    pub content: Option<Value>,
}

/// 頁尾模板可改的欄位。
#[derive(Debug, Default, Clone)]
pub struct FooterPatch {
    pub name: Option<String>,
    pub content: Option<Value>,
}

#[async_trait]
pub trait Store: Send + Sync {
    // ── 首頁模板 ─────────────────────────────────────────────────────────

    async fn list_home_pages(&self, tenant: Uuid) -> StoreResult<Vec<HomePageTemplate>>;

    async fn get_home_page(&self, tenant: Uuid, id: Uuid) -> StoreResult<HomePageTemplate>;

    async fn create_home_page_draft(
        &self,
        tenant: Uuid,
        name: String,
    ) -> StoreResult<HomePageTemplate>;

    /// 存草稿:僅 `draft` 狀態可改(已發布凍結)。
    async fn save_home_page_draft(
        &self,
        tenant: Uuid,
        id: Uuid,
        patch: HomePagePatch,
    ) -> StoreResult<HomePageTemplate>;

    /// 發布:draft → active,套上最終欄位,version + 1。
    async fn publish_home_page(
        &self,
        tenant: Uuid,
        id: Uuid,
        patch: HomePagePatch,
    ) -> StoreResult<HomePageTemplate>;

    /// 複製成新草稿(已發布的模板要改,只能走這條)。
    async fn duplicate_home_page(&self, tenant: Uuid, id: Uuid) -> StoreResult<HomePageTemplate>;

    /// 就地調整優先序(寫入 targeting.priority)。首頁模板專有。
    async fn set_home_page_priority(
        &self,
        tenant: Uuid,
        id: Uuid,
        priority: i64,
    ) -> StoreResult<HomePageTemplate>;

    /// 暫停 / 恢復。常態版不可暫停。
    async fn set_home_page_paused(
        &self,
        tenant: Uuid,
        id: Uuid,
        paused: bool,
    ) -> StoreResult<HomePageTemplate>;

    /// 刪除。常態版與 active 不可刪。
    async fn remove_home_page(&self, tenant: Uuid, id: Uuid) -> StoreResult<()>;

    async fn home_page_audit(&self, tenant: Uuid, id: Uuid) -> StoreResult<Vec<AuditEntry>>;

    // ── 頁首模板 ─────────────────────────────────────────────────────────

    async fn list_headers(&self, tenant: Uuid) -> StoreResult<Vec<HeaderTemplate>>;

    async fn get_header(&self, tenant: Uuid, id: Uuid) -> StoreResult<HeaderTemplate>;

    async fn create_header_draft(&self, tenant: Uuid, name: String) -> StoreResult<HeaderTemplate>;

    async fn save_header_draft(
        &self,
        tenant: Uuid,
        id: Uuid,
        patch: HeaderPatch,
    ) -> StoreResult<HeaderTemplate>;

    async fn publish_header(
        &self,
        tenant: Uuid,
        id: Uuid,
        patch: HeaderPatch,
    ) -> StoreResult<HeaderTemplate>;

    async fn duplicate_header(&self, tenant: Uuid, id: Uuid) -> StoreResult<HeaderTemplate>;

    async fn set_header_paused(
        &self,
        tenant: Uuid,
        id: Uuid,
        paused: bool,
    ) -> StoreResult<HeaderTemplate>;

    /// 設為站台預設;同租戶其餘頁首的 `is_site_default` 取消。頁首 / 頁尾專有。
    async fn set_header_site_default(&self, tenant: Uuid, id: Uuid) -> StoreResult<HeaderTemplate>;

    async fn remove_header(&self, tenant: Uuid, id: Uuid) -> StoreResult<()>;

    async fn header_audit(&self, tenant: Uuid, id: Uuid) -> StoreResult<Vec<AuditEntry>>;

    /// 站台預設頁首的內容:取 `is_site_default` 的 active,沒有就取第一個 active,
    /// 都沒有回空陣列。編輯器預覽首頁時用來湊出外框。
    async fn site_default_header_content(&self, tenant: Uuid) -> StoreResult<Value>;

    // ── 頁尾模板 ─────────────────────────────────────────────────────────

    async fn list_footers(&self, tenant: Uuid) -> StoreResult<Vec<FooterTemplate>>;

    async fn get_footer(&self, tenant: Uuid, id: Uuid) -> StoreResult<FooterTemplate>;

    async fn create_footer_draft(&self, tenant: Uuid, name: String) -> StoreResult<FooterTemplate>;

    async fn save_footer_draft(
        &self,
        tenant: Uuid,
        id: Uuid,
        patch: FooterPatch,
    ) -> StoreResult<FooterTemplate>;

    async fn publish_footer(
        &self,
        tenant: Uuid,
        id: Uuid,
        patch: FooterPatch,
    ) -> StoreResult<FooterTemplate>;

    async fn duplicate_footer(&self, tenant: Uuid, id: Uuid) -> StoreResult<FooterTemplate>;

    async fn set_footer_paused(
        &self,
        tenant: Uuid,
        id: Uuid,
        paused: bool,
    ) -> StoreResult<FooterTemplate>;

    async fn set_footer_site_default(&self, tenant: Uuid, id: Uuid) -> StoreResult<FooterTemplate>;

    async fn remove_footer(&self, tenant: Uuid, id: Uuid) -> StoreResult<()>;

    async fn footer_audit(&self, tenant: Uuid, id: Uuid) -> StoreResult<Vec<AuditEntry>>;

    async fn site_default_footer_content(&self, tenant: Uuid) -> StoreResult<Value>;
}
