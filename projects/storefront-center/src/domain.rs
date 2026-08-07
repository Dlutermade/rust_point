//! 領域型別:三個獨立實體 —— 首頁模板 / 頁首模板 / 頁尾模板。
//!
//! 三者**沒有共同上位分類**。首頁模板有 SEO、完整生效條件、外框覆寫;
//! 頁首 / 頁尾只有「哪一份是站台預設」。共用的只有狀態機(`TemplateStatus`)——
//! 那是機制不是分類。
//!
//! `HeaderTemplate` 與 `FooterTemplate` 目前欄位一模一樣,仍寫成兩個型別:
//! 一是型別安全(頁首不會被誤傳進吃頁尾的地方),二是它們本來就會分化
//! (頁尾的多欄連結配置、頁首的 sticky 行為),三是「恰好現在長一樣」
//! 不構成合併的理由。
//!
//! `targeting` / `content` 是後端此刻**不解讀**的 JSON blob(渲染引擎 M4 才用),
//! 先以 `serde_json::Value` 承載,存 JSONB。

use serde::{Deserialize, Serialize};
use serde_json::Value;
use time::OffsetDateTime;
use uuid::Uuid;

/// 模板狀態:草稿(可編)→ 已發布 active(凍結、上線)⇄ 暫停 paused(凍結、不上線)。
/// 三個實體共用同一套狀態機。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TemplateStatus {
    Draft,
    Active,
    Paused,
}

/// 首頁模板。每租戶可有多份,哪份生效由 `targeting` 於渲染時解析。
///
/// v1 不帶 slug:首頁網址恆為 `/`,而同一網址本來就對多份模板
/// (常態版與周年慶版共用 `/`)—— slug 不是模板的屬性。
#[derive(Debug, Clone)]
pub struct HomePageTemplate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub status: TemplateStatus,
    /// 常態版:不設條件、優先序最低、永久兜底。每租戶恰一份。
    pub is_fallback: bool,
    pub seo_title: Option<String>,
    pub seo_description: Option<String>,
    /// 生效 / 定向規則(schedule / audience / source / priority)。後端不解讀。
    pub targeting: Value,
    /// 外框覆寫:要套哪份頁首 / 頁尾。兩者可分開指定;`None` = 跟隨站台預設。
    pub header_template_id: Option<Uuid>,
    pub footer_template_id: Option<Uuid>,
    /// 區塊實例樹(最外層為 array)。後端不解讀。
    pub content: Value,
    pub version: i64,
    pub note: Option<String>,
    pub updated_at: OffsetDateTime,
    pub published_at: Option<OffsetDateTime>,
}

/// 頁首模板。每租戶可有多份,其中一份是站台預設。不吃生效條件。
#[derive(Debug, Clone)]
pub struct HeaderTemplate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub status: TemplateStatus,
    /// 站台預設:全站標準用哪一份。每租戶至多一份。
    pub is_site_default: bool,
    pub content: Value,
    pub version: i64,
    pub note: Option<String>,
    pub updated_at: OffsetDateTime,
    pub published_at: Option<OffsetDateTime>,
}

/// 頁尾模板。語意同頁首,但不是同一類東西 —— 見模組註解。
#[derive(Debug, Clone)]
pub struct FooterTemplate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub status: TemplateStatus,
    pub is_site_default: bool,
    pub content: Value,
    pub version: i64,
    pub note: Option<String>,
    pub updated_at: OffsetDateTime,
    pub published_at: Option<OffsetDateTime>,
}

/// 異動動作。三個實體共用這個 enum,但**各自的合法子集不同**:
/// `Priority` 只有首頁模板有(生效條件才有優先序),
/// `SetSiteDefault` 只有頁首 / 頁尾有。
///
/// Rust 端不為此拆三個 enum(那只是把同一組字串抄三遍);
/// 真正的守門在 DB —— 三張 audit 表各自 `CHECK (action IN …)`。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AuditAction {
    Create,
    SaveDraft,
    Publish,
    Duplicate,
    /// 僅首頁模板。
    Priority,
    Pause,
    Resume,
    /// 僅頁首 / 頁尾模板。
    SetSiteDefault,
}

/// 異動紀錄(v1 無帳號系統,先不記 who)。
/// 三個實體在 DB 各有一張 audit 表,取出後都是這個形狀。
#[derive(Debug, Clone)]
pub struct AuditEntry {
    pub id: Uuid,
    pub template_id: Uuid,
    pub action: AuditAction,
    pub detail: Option<String>,
    pub at: OffsetDateTime,
}
