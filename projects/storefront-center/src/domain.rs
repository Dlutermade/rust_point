//! 領域型別:頁面模板(Model B)。
//!
//! 對齊編輯器前端(admin)已成形的契約:每個版位(slot)可有多個模板,
//! 由 targeting(檔期 / 受眾 / 來源 / 優先序)在渲染時解析出當下呈現;
//! `is_default` 是常態版(永久兜底 / 站台預設)。
//!
//! 結構化欄位(slot / status / is_default / version…)強型別;
//! targeting / chrome / content 是後端此刻**不解讀**的 JSON blob(渲染引擎 M4 才用),
//! 先以 `serde_json::Value` 承載,存 JSONB。

use serde::{Deserialize, Serialize};
use serde_json::Value;
use time::OffsetDateTime;
use uuid::Uuid;

/// 版位:首頁 / 頁首 / 頁尾。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Slot {
    Home,
    Header,
    Footer,
}

impl Slot {
    /// 外框版位(頁首 / 頁尾)才有「站台預設」語意;首頁的 is_default 是常態版。
    pub fn is_chrome(self) -> bool {
        matches!(self, Slot::Header | Slot::Footer)
    }
}

/// 模板狀態:草稿(可編)→ 已發布 active(凍結、上線)⇄ 暫停 paused(凍結、不上線)。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TemplateStatus {
    Draft,
    Active,
    Paused,
}

/// 頁面模板(實體)。content 是最外層區塊樹(JSON array),targeting / chrome 為 JSON 物件。
#[derive(Debug, Clone)]
pub struct Template {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub slot: Slot,
    pub name: String,
    pub status: TemplateStatus,
    /// 頁首/頁尾:站台預設;首頁:常態版(永久兜底)。
    pub is_default: bool,
    /// 生效 / 定向規則(schedule / audience / source / priority)。後端不解讀。
    pub targeting: Value,
    /// 外框覆寫({headerId, footerId})。後端不解讀。
    pub chrome: Value,
    /// 區塊實例樹(最外層為 array)。後端不解讀。
    pub content: Value,
    pub version: i64,
    pub note: Option<String>,
    pub updated_at: OffsetDateTime,
    pub published_at: Option<OffsetDateTime>,
}

/// 異動動作(對齊 admin 的 AuditAction)。
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AuditAction {
    Create,
    SaveDraft,
    Publish,
    Duplicate,
    Priority,
    Pause,
    Resume,
    SetDefault,
}

/// 異動紀錄(v1 無登入系統,先不記 who)。
#[derive(Debug, Clone)]
pub struct AuditEntry {
    pub id: Uuid,
    pub template_id: Uuid,
    pub action: AuditAction,
    pub detail: Option<String>,
    pub at: OffsetDateTime,
}
