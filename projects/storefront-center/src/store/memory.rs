//! 記憶體 store(開發用,不接 DB)。狀態機 / 不可變性規則都在這:
//! 已發布凍結、常態版 / 站台預設不可暫停或刪除、每租戶至多一個站台預設。
//! 之後換 Postgres adapter 時,這些規則搬到 SQL / 交易裡,API 層不動。
//!
//! 三個實體各一組資料與方法。頁首 / 頁尾的實作目前逐行相同 —— 沒有抽共用泛型,
//! 因為這整個檔案是拋棄式的(PG adapter 進場即刪),為它發明抽象不划算。

use std::cmp::Reverse;
use std::collections::HashMap;
use std::sync::RwLock;

use async_trait::async_trait;
use serde_json::{Value, json};
use time::OffsetDateTime;
use time::macros::datetime;
use uuid::Uuid;

use super::{FooterPatch, HeaderPatch, HomePagePatch, Store, StoreError, StoreResult};
use crate::domain::{
    AuditAction, AuditEntry, FooterTemplate, HeaderTemplate, HomePageTemplate, TemplateStatus,
};

/// 單一預設租戶(選店尚未接 DB 期間,所有請求都掛在這底下)。
pub const DEFAULT_TENANT: Uuid = Uuid::from_u128(0x0000_0000_0000_7000_8000_0000_0000_0001);

struct Data {
    home_pages: HashMap<Uuid, HomePageTemplate>,
    headers: HashMap<Uuid, HeaderTemplate>,
    footers: HashMap<Uuid, FooterTemplate>,
    home_page_audits: Vec<AuditEntry>,
    header_audits: Vec<AuditEntry>,
    footer_audits: Vec<AuditEntry>,
}

pub struct InMemoryStore {
    inner: RwLock<Data>,
}

impl InMemoryStore {
    /// 帶種子資料,讓 API 一起手就有東西可回。
    pub fn seeded() -> Self {
        let t = DEFAULT_TENANT;
        let mut home_pages = HashMap::new();
        let mut headers = HashMap::new();
        let mut footers = HashMap::new();

        for tpl in [
            seed_home_page(
                t,
                "預設首頁",
                TemplateStatus::Active,
                true,
                json!({}),
                datetime!(2026-07-20 14:05 UTC),
                Some("常態版(永久兜底)"),
            ),
            seed_home_page(
                t,
                "周年慶首頁",
                TemplateStatus::Active,
                false,
                json!({
                    "schedule": { "start": "2026-08-01T00:00:00+08:00", "end": "2026-08-14T23:59:59+08:00" },
                    "priority": 100
                }),
                datetime!(2026-07-24 09:30 UTC),
                Some("檔期 8/1–8/14"),
            ),
            seed_home_page(
                t,
                "實驗版 A",
                TemplateStatus::Draft,
                false,
                json!({}),
                datetime!(2026-07-25 18:12 UTC),
                None,
            ),
        ] {
            home_pages.insert(tpl.id, tpl);
        }

        for tpl in [
            seed_header(
                t,
                "預設頁首",
                TemplateStatus::Active,
                true,
                datetime!(2026-07-20 14:05 UTC),
                Some("站台預設"),
            ),
            seed_header(
                t,
                "促銷頁首",
                TemplateStatus::Active,
                false,
                datetime!(2026-07-28 10:00 UTC),
                Some("另一版頁首,可設為站台預設"),
            ),
        ] {
            headers.insert(tpl.id, tpl);
        }

        let footer = seed_footer(
            t,
            "預設頁尾",
            TemplateStatus::Active,
            true,
            datetime!(2026-07-20 14:05 UTC),
            Some("站台預設"),
        );
        footers.insert(footer.id, footer);

        Self {
            inner: RwLock::new(Data {
                home_pages,
                headers,
                footers,
                home_page_audits: Vec::new(),
                header_audits: Vec::new(),
                footer_audits: Vec::new(),
            }),
        }
    }
}

// ── 種子 ────────────────────────────────────────────────────────────────
// 欄位平鋪比包一層 struct 直白;PG adapter 進場後整塊會消失。

fn seed_home_page(
    tenant_id: Uuid,
    name: &str,
    status: TemplateStatus,
    is_fallback: bool,
    targeting: Value,
    updated_at: OffsetDateTime,
    note: Option<&str>,
) -> HomePageTemplate {
    let published = matches!(status, TemplateStatus::Active | TemplateStatus::Paused);
    HomePageTemplate {
        id: Uuid::now_v7(),
        tenant_id,
        name: name.to_string(),
        status,
        is_fallback,
        seo_title: None,
        seo_description: None,
        targeting,
        header_template_id: None,
        footer_template_id: None,
        content: json!([]),
        version: if published { 1 } else { 0 },
        note: note.map(str::to_string),
        updated_at,
        published_at: published.then_some(updated_at),
    }
}

fn seed_header(
    tenant_id: Uuid,
    name: &str,
    status: TemplateStatus,
    is_site_default: bool,
    updated_at: OffsetDateTime,
    note: Option<&str>,
) -> HeaderTemplate {
    let published = matches!(status, TemplateStatus::Active | TemplateStatus::Paused);
    HeaderTemplate {
        id: Uuid::now_v7(),
        tenant_id,
        name: name.to_string(),
        status,
        is_site_default,
        content: json!([]),
        version: if published { 1 } else { 0 },
        note: note.map(str::to_string),
        updated_at,
        published_at: published.then_some(updated_at),
    }
}

fn seed_footer(
    tenant_id: Uuid,
    name: &str,
    status: TemplateStatus,
    is_site_default: bool,
    updated_at: OffsetDateTime,
    note: Option<&str>,
) -> FooterTemplate {
    let published = matches!(status, TemplateStatus::Active | TemplateStatus::Paused);
    FooterTemplate {
        id: Uuid::now_v7(),
        tenant_id,
        name: name.to_string(),
        status,
        is_site_default,
        content: json!([]),
        version: if published { 1 } else { 0 },
        note: note.map(str::to_string),
        updated_at,
        published_at: published.then_some(updated_at),
    }
}

// ── 內部輔助 ────────────────────────────────────────────────────────────

/// 名稱驗證:去頭尾空白,不可為空。
fn clean_name(name: &str) -> StoreResult<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(StoreError::BadRequest("名稱不可為空".into()));
    }
    Ok(name.to_string())
}

impl Data {
    fn home_page_mut(&mut self, tenant: Uuid, id: Uuid) -> StoreResult<&mut HomePageTemplate> {
        match self.home_pages.get_mut(&id) {
            Some(t) if t.tenant_id == tenant => Ok(t),
            _ => Err(StoreError::NotFound),
        }
    }

    fn header_mut(&mut self, tenant: Uuid, id: Uuid) -> StoreResult<&mut HeaderTemplate> {
        match self.headers.get_mut(&id) {
            Some(t) if t.tenant_id == tenant => Ok(t),
            _ => Err(StoreError::NotFound),
        }
    }

    fn footer_mut(&mut self, tenant: Uuid, id: Uuid) -> StoreResult<&mut FooterTemplate> {
        match self.footers.get_mut(&id) {
            Some(t) if t.tenant_id == tenant => Ok(t),
            _ => Err(StoreError::NotFound),
        }
    }

    fn log(
        log: &mut Vec<AuditEntry>,
        template_id: Uuid,
        action: AuditAction,
        detail: Option<String>,
    ) {
        log.push(AuditEntry {
            id: Uuid::now_v7(),
            template_id,
            action,
            detail,
            at: OffsetDateTime::now_utc(),
        });
    }
}

/// 取某模板的異動紀錄(新到舊)。模板不存在 / 不屬此租戶 → NotFound。
fn audit_of(log: &[AuditEntry], exists: bool, id: Uuid) -> StoreResult<Vec<AuditEntry>> {
    if !exists {
        return Err(StoreError::NotFound);
    }
    let mut out: Vec<AuditEntry> = log
        .iter()
        .filter(|a| a.template_id == id)
        .cloned()
        .collect();
    out.sort_by_key(|a| Reverse(a.at));
    Ok(out)
}

#[async_trait]
impl Store for InMemoryStore {
    // ── 首頁模板 ─────────────────────────────────────────────────────────

    async fn list_home_pages(&self, tenant: Uuid) -> StoreResult<Vec<HomePageTemplate>> {
        let data = self.inner.read().unwrap();
        let mut out: Vec<HomePageTemplate> = data
            .home_pages
            .values()
            .filter(|t| t.tenant_id == tenant)
            .cloned()
            .collect();
        // 常態版排最後、其餘依更新時間新到舊 —— 給列表穩定順序。
        out.sort_by(|a, b| {
            a.is_fallback
                .cmp(&b.is_fallback)
                .then(b.updated_at.cmp(&a.updated_at))
        });
        Ok(out)
    }

    async fn get_home_page(&self, tenant: Uuid, id: Uuid) -> StoreResult<HomePageTemplate> {
        let data = self.inner.read().unwrap();
        data.home_pages
            .get(&id)
            .filter(|t| t.tenant_id == tenant)
            .cloned()
            .ok_or(StoreError::NotFound)
    }

    async fn create_home_page_draft(
        &self,
        tenant: Uuid,
        name: String,
    ) -> StoreResult<HomePageTemplate> {
        let name = clean_name(&name)?;
        let tpl = HomePageTemplate {
            id: Uuid::now_v7(),
            tenant_id: tenant,
            name,
            status: TemplateStatus::Draft,
            is_fallback: false,
            seo_title: None,
            seo_description: None,
            targeting: json!({}),
            header_template_id: None,
            footer_template_id: None,
            content: json!([]),
            version: 0,
            note: None,
            updated_at: OffsetDateTime::now_utc(),
            published_at: None,
        };
        let mut data = self.inner.write().unwrap();
        Data::log(
            &mut data.home_page_audits,
            tpl.id,
            AuditAction::Create,
            None,
        );
        data.home_pages.insert(tpl.id, tpl.clone());
        Ok(tpl)
    }

    async fn save_home_page_draft(
        &self,
        tenant: Uuid,
        id: Uuid,
        patch: HomePagePatch,
    ) -> StoreResult<HomePageTemplate> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.home_page_mut(tenant, id)?;
            if t.status != TemplateStatus::Draft {
                return Err(StoreError::Conflict(
                    "已發布的模板不可修改,請複製一份再編輯".into(),
                ));
            }
            apply_home_page_patch(t, patch)?;
            t.updated_at = OffsetDateTime::now_utc();
        }
        Data::log(&mut data.home_page_audits, id, AuditAction::SaveDraft, None);
        Ok(data.home_pages[&id].clone())
    }

    async fn publish_home_page(
        &self,
        tenant: Uuid,
        id: Uuid,
        patch: HomePagePatch,
    ) -> StoreResult<HomePageTemplate> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.home_page_mut(tenant, id)?;
            if t.status != TemplateStatus::Draft {
                return Err(StoreError::Conflict("只有草稿可以發布".into()));
            }
            apply_home_page_patch(t, patch)?;
            let now = OffsetDateTime::now_utc();
            t.status = TemplateStatus::Active;
            t.version += 1;
            t.updated_at = now;
            t.published_at = Some(now);
        }
        Data::log(&mut data.home_page_audits, id, AuditAction::Publish, None);
        Ok(data.home_pages[&id].clone())
    }

    async fn duplicate_home_page(&self, tenant: Uuid, id: Uuid) -> StoreResult<HomePageTemplate> {
        let mut data = self.inner.write().unwrap();
        let source = data
            .home_pages
            .get(&id)
            .filter(|t| t.tenant_id == tenant)
            .ok_or(StoreError::NotFound)?;
        let copy = HomePageTemplate {
            id: Uuid::now_v7(),
            name: format!("{} 複本", source.name),
            status: TemplateStatus::Draft,
            // 複本不繼承「常態版」身分 —— 每租戶只能有一份。
            is_fallback: false,
            version: 0,
            note: None,
            updated_at: OffsetDateTime::now_utc(),
            published_at: None,
            ..source.clone()
        };
        let new_id = copy.id;
        Data::log(
            &mut data.home_page_audits,
            new_id,
            AuditAction::Duplicate,
            Some(format!("複製自 {id}")),
        );
        data.home_pages.insert(new_id, copy.clone());
        Ok(copy)
    }

    async fn set_home_page_priority(
        &self,
        tenant: Uuid,
        id: Uuid,
        priority: i64,
    ) -> StoreResult<HomePageTemplate> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.home_page_mut(tenant, id)?;
            if !t.targeting.is_object() {
                t.targeting = json!({});
            }
            t.targeting["priority"] = json!(priority);
            t.updated_at = OffsetDateTime::now_utc();
        }
        Data::log(
            &mut data.home_page_audits,
            id,
            AuditAction::Priority,
            Some(priority.to_string()),
        );
        Ok(data.home_pages[&id].clone())
    }

    async fn set_home_page_paused(
        &self,
        tenant: Uuid,
        id: Uuid,
        paused: bool,
    ) -> StoreResult<HomePageTemplate> {
        let mut data = self.inner.write().unwrap();
        let action;
        {
            let t = data.home_page_mut(tenant, id)?;
            if paused {
                if t.is_fallback {
                    return Err(StoreError::Conflict("常態版不可暫停".into()));
                }
                if t.status != TemplateStatus::Active {
                    return Err(StoreError::Conflict("只有已發布的模板可以暫停".into()));
                }
                t.status = TemplateStatus::Paused;
                action = AuditAction::Pause;
            } else {
                if t.status != TemplateStatus::Paused {
                    return Err(StoreError::Conflict("只有暫停中的模板可以恢復".into()));
                }
                t.status = TemplateStatus::Active;
                action = AuditAction::Resume;
            }
            t.updated_at = OffsetDateTime::now_utc();
        }
        Data::log(&mut data.home_page_audits, id, action, None);
        Ok(data.home_pages[&id].clone())
    }

    async fn remove_home_page(&self, tenant: Uuid, id: Uuid) -> StoreResult<()> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.home_page_mut(tenant, id)?;
            if t.is_fallback {
                return Err(StoreError::Conflict("常態版不可刪除".into()));
            }
            if t.status == TemplateStatus::Active {
                return Err(StoreError::Conflict("已發布的模板不可刪除,請先暫停".into()));
            }
        }
        data.home_pages.remove(&id);
        Ok(())
    }

    async fn home_page_audit(&self, tenant: Uuid, id: Uuid) -> StoreResult<Vec<AuditEntry>> {
        let data = self.inner.read().unwrap();
        let exists = data
            .home_pages
            .get(&id)
            .is_some_and(|t| t.tenant_id == tenant);
        audit_of(&data.home_page_audits, exists, id)
    }

    // ── 頁首模板 ─────────────────────────────────────────────────────────

    async fn list_headers(&self, tenant: Uuid) -> StoreResult<Vec<HeaderTemplate>> {
        let data = self.inner.read().unwrap();
        let mut out: Vec<HeaderTemplate> = data
            .headers
            .values()
            .filter(|t| t.tenant_id == tenant)
            .cloned()
            .collect();
        out.sort_by(|a, b| {
            a.is_site_default
                .cmp(&b.is_site_default)
                .then(b.updated_at.cmp(&a.updated_at))
        });
        Ok(out)
    }

    async fn get_header(&self, tenant: Uuid, id: Uuid) -> StoreResult<HeaderTemplate> {
        let data = self.inner.read().unwrap();
        data.headers
            .get(&id)
            .filter(|t| t.tenant_id == tenant)
            .cloned()
            .ok_or(StoreError::NotFound)
    }

    async fn create_header_draft(&self, tenant: Uuid, name: String) -> StoreResult<HeaderTemplate> {
        let name = clean_name(&name)?;
        let tpl = HeaderTemplate {
            id: Uuid::now_v7(),
            tenant_id: tenant,
            name,
            status: TemplateStatus::Draft,
            is_site_default: false,
            content: json!([]),
            version: 0,
            note: None,
            updated_at: OffsetDateTime::now_utc(),
            published_at: None,
        };
        let mut data = self.inner.write().unwrap();
        Data::log(&mut data.header_audits, tpl.id, AuditAction::Create, None);
        data.headers.insert(tpl.id, tpl.clone());
        Ok(tpl)
    }

    async fn save_header_draft(
        &self,
        tenant: Uuid,
        id: Uuid,
        patch: HeaderPatch,
    ) -> StoreResult<HeaderTemplate> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.header_mut(tenant, id)?;
            if t.status != TemplateStatus::Draft {
                return Err(StoreError::Conflict(
                    "已發布的模板不可修改,請複製一份再編輯".into(),
                ));
            }
            if let Some(name) = patch.name {
                t.name = clean_name(&name)?;
            }
            if let Some(content) = patch.content {
                t.content = content;
            }
            t.updated_at = OffsetDateTime::now_utc();
        }
        Data::log(&mut data.header_audits, id, AuditAction::SaveDraft, None);
        Ok(data.headers[&id].clone())
    }

    async fn publish_header(
        &self,
        tenant: Uuid,
        id: Uuid,
        patch: HeaderPatch,
    ) -> StoreResult<HeaderTemplate> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.header_mut(tenant, id)?;
            if t.status != TemplateStatus::Draft {
                return Err(StoreError::Conflict("只有草稿可以發布".into()));
            }
            if let Some(name) = patch.name {
                t.name = clean_name(&name)?;
            }
            if let Some(content) = patch.content {
                t.content = content;
            }
            let now = OffsetDateTime::now_utc();
            t.status = TemplateStatus::Active;
            t.version += 1;
            t.updated_at = now;
            t.published_at = Some(now);
        }
        Data::log(&mut data.header_audits, id, AuditAction::Publish, None);
        Ok(data.headers[&id].clone())
    }

    async fn duplicate_header(&self, tenant: Uuid, id: Uuid) -> StoreResult<HeaderTemplate> {
        let mut data = self.inner.write().unwrap();
        let source = data
            .headers
            .get(&id)
            .filter(|t| t.tenant_id == tenant)
            .ok_or(StoreError::NotFound)?;
        let copy = HeaderTemplate {
            id: Uuid::now_v7(),
            name: format!("{} 複本", source.name),
            status: TemplateStatus::Draft,
            is_site_default: false,
            version: 0,
            note: None,
            updated_at: OffsetDateTime::now_utc(),
            published_at: None,
            ..source.clone()
        };
        let new_id = copy.id;
        Data::log(
            &mut data.header_audits,
            new_id,
            AuditAction::Duplicate,
            Some(format!("複製自 {id}")),
        );
        data.headers.insert(new_id, copy.clone());
        Ok(copy)
    }

    async fn set_header_paused(
        &self,
        tenant: Uuid,
        id: Uuid,
        paused: bool,
    ) -> StoreResult<HeaderTemplate> {
        let mut data = self.inner.write().unwrap();
        let action;
        {
            let t = data.header_mut(tenant, id)?;
            if paused {
                if t.is_site_default {
                    return Err(StoreError::Conflict("站台預設不可暫停".into()));
                }
                if t.status != TemplateStatus::Active {
                    return Err(StoreError::Conflict("只有已發布的模板可以暫停".into()));
                }
                t.status = TemplateStatus::Paused;
                action = AuditAction::Pause;
            } else {
                if t.status != TemplateStatus::Paused {
                    return Err(StoreError::Conflict("只有暫停中的模板可以恢復".into()));
                }
                t.status = TemplateStatus::Active;
                action = AuditAction::Resume;
            }
            t.updated_at = OffsetDateTime::now_utc();
        }
        Data::log(&mut data.header_audits, id, action, None);
        Ok(data.headers[&id].clone())
    }

    async fn set_header_site_default(&self, tenant: Uuid, id: Uuid) -> StoreResult<HeaderTemplate> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.header_mut(tenant, id)?;
            if t.status != TemplateStatus::Active {
                return Err(StoreError::Conflict("只有已發布的模板能設站台預設".into()));
            }
        }
        // 同租戶其餘取消預設,目標設為預設。
        for other in data.headers.values_mut() {
            if other.tenant_id == tenant {
                other.is_site_default = other.id == id;
            }
        }
        if let Some(t) = data.headers.get_mut(&id) {
            t.updated_at = OffsetDateTime::now_utc();
        }
        Data::log(
            &mut data.header_audits,
            id,
            AuditAction::SetSiteDefault,
            None,
        );
        Ok(data.headers[&id].clone())
    }

    async fn remove_header(&self, tenant: Uuid, id: Uuid) -> StoreResult<()> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.header_mut(tenant, id)?;
            if t.is_site_default {
                return Err(StoreError::Conflict("站台預設不可刪除".into()));
            }
            if t.status == TemplateStatus::Active {
                return Err(StoreError::Conflict("已發布的模板不可刪除,請先暫停".into()));
            }
        }
        // 被首頁模板指定為外框的,連帶清成「跟隨站台預設」。
        // PG 端由 FK 的 ON DELETE SET NULL 接手。
        for page in data.home_pages.values_mut() {
            if page.header_template_id == Some(id) {
                page.header_template_id = None;
            }
        }
        data.headers.remove(&id);
        Ok(())
    }

    async fn header_audit(&self, tenant: Uuid, id: Uuid) -> StoreResult<Vec<AuditEntry>> {
        let data = self.inner.read().unwrap();
        let exists = data.headers.get(&id).is_some_and(|t| t.tenant_id == tenant);
        audit_of(&data.header_audits, exists, id)
    }

    async fn site_default_header_content(&self, tenant: Uuid) -> StoreResult<Value> {
        let data = self.inner.read().unwrap();
        let actives = || {
            data.headers
                .values()
                .filter(|t| t.tenant_id == tenant && t.status == TemplateStatus::Active)
        };
        let winner = actives()
            .find(|t| t.is_site_default)
            .or_else(|| actives().next());
        Ok(winner
            .map(|t| t.content.clone())
            .unwrap_or_else(|| json!([])))
    }

    // ── 頁尾模板 ─────────────────────────────────────────────────────────

    async fn list_footers(&self, tenant: Uuid) -> StoreResult<Vec<FooterTemplate>> {
        let data = self.inner.read().unwrap();
        let mut out: Vec<FooterTemplate> = data
            .footers
            .values()
            .filter(|t| t.tenant_id == tenant)
            .cloned()
            .collect();
        out.sort_by(|a, b| {
            a.is_site_default
                .cmp(&b.is_site_default)
                .then(b.updated_at.cmp(&a.updated_at))
        });
        Ok(out)
    }

    async fn get_footer(&self, tenant: Uuid, id: Uuid) -> StoreResult<FooterTemplate> {
        let data = self.inner.read().unwrap();
        data.footers
            .get(&id)
            .filter(|t| t.tenant_id == tenant)
            .cloned()
            .ok_or(StoreError::NotFound)
    }

    async fn create_footer_draft(&self, tenant: Uuid, name: String) -> StoreResult<FooterTemplate> {
        let name = clean_name(&name)?;
        let tpl = FooterTemplate {
            id: Uuid::now_v7(),
            tenant_id: tenant,
            name,
            status: TemplateStatus::Draft,
            is_site_default: false,
            content: json!([]),
            version: 0,
            note: None,
            updated_at: OffsetDateTime::now_utc(),
            published_at: None,
        };
        let mut data = self.inner.write().unwrap();
        Data::log(&mut data.footer_audits, tpl.id, AuditAction::Create, None);
        data.footers.insert(tpl.id, tpl.clone());
        Ok(tpl)
    }

    async fn save_footer_draft(
        &self,
        tenant: Uuid,
        id: Uuid,
        patch: FooterPatch,
    ) -> StoreResult<FooterTemplate> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.footer_mut(tenant, id)?;
            if t.status != TemplateStatus::Draft {
                return Err(StoreError::Conflict(
                    "已發布的模板不可修改,請複製一份再編輯".into(),
                ));
            }
            if let Some(name) = patch.name {
                t.name = clean_name(&name)?;
            }
            if let Some(content) = patch.content {
                t.content = content;
            }
            t.updated_at = OffsetDateTime::now_utc();
        }
        Data::log(&mut data.footer_audits, id, AuditAction::SaveDraft, None);
        Ok(data.footers[&id].clone())
    }

    async fn publish_footer(
        &self,
        tenant: Uuid,
        id: Uuid,
        patch: FooterPatch,
    ) -> StoreResult<FooterTemplate> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.footer_mut(tenant, id)?;
            if t.status != TemplateStatus::Draft {
                return Err(StoreError::Conflict("只有草稿可以發布".into()));
            }
            if let Some(name) = patch.name {
                t.name = clean_name(&name)?;
            }
            if let Some(content) = patch.content {
                t.content = content;
            }
            let now = OffsetDateTime::now_utc();
            t.status = TemplateStatus::Active;
            t.version += 1;
            t.updated_at = now;
            t.published_at = Some(now);
        }
        Data::log(&mut data.footer_audits, id, AuditAction::Publish, None);
        Ok(data.footers[&id].clone())
    }

    async fn duplicate_footer(&self, tenant: Uuid, id: Uuid) -> StoreResult<FooterTemplate> {
        let mut data = self.inner.write().unwrap();
        let source = data
            .footers
            .get(&id)
            .filter(|t| t.tenant_id == tenant)
            .ok_or(StoreError::NotFound)?;
        let copy = FooterTemplate {
            id: Uuid::now_v7(),
            name: format!("{} 複本", source.name),
            status: TemplateStatus::Draft,
            is_site_default: false,
            version: 0,
            note: None,
            updated_at: OffsetDateTime::now_utc(),
            published_at: None,
            ..source.clone()
        };
        let new_id = copy.id;
        Data::log(
            &mut data.footer_audits,
            new_id,
            AuditAction::Duplicate,
            Some(format!("複製自 {id}")),
        );
        data.footers.insert(new_id, copy.clone());
        Ok(copy)
    }

    async fn set_footer_paused(
        &self,
        tenant: Uuid,
        id: Uuid,
        paused: bool,
    ) -> StoreResult<FooterTemplate> {
        let mut data = self.inner.write().unwrap();
        let action;
        {
            let t = data.footer_mut(tenant, id)?;
            if paused {
                if t.is_site_default {
                    return Err(StoreError::Conflict("站台預設不可暫停".into()));
                }
                if t.status != TemplateStatus::Active {
                    return Err(StoreError::Conflict("只有已發布的模板可以暫停".into()));
                }
                t.status = TemplateStatus::Paused;
                action = AuditAction::Pause;
            } else {
                if t.status != TemplateStatus::Paused {
                    return Err(StoreError::Conflict("只有暫停中的模板可以恢復".into()));
                }
                t.status = TemplateStatus::Active;
                action = AuditAction::Resume;
            }
            t.updated_at = OffsetDateTime::now_utc();
        }
        Data::log(&mut data.footer_audits, id, action, None);
        Ok(data.footers[&id].clone())
    }

    async fn set_footer_site_default(&self, tenant: Uuid, id: Uuid) -> StoreResult<FooterTemplate> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.footer_mut(tenant, id)?;
            if t.status != TemplateStatus::Active {
                return Err(StoreError::Conflict("只有已發布的模板能設站台預設".into()));
            }
        }
        for other in data.footers.values_mut() {
            if other.tenant_id == tenant {
                other.is_site_default = other.id == id;
            }
        }
        if let Some(t) = data.footers.get_mut(&id) {
            t.updated_at = OffsetDateTime::now_utc();
        }
        Data::log(
            &mut data.footer_audits,
            id,
            AuditAction::SetSiteDefault,
            None,
        );
        Ok(data.footers[&id].clone())
    }

    async fn remove_footer(&self, tenant: Uuid, id: Uuid) -> StoreResult<()> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.footer_mut(tenant, id)?;
            if t.is_site_default {
                return Err(StoreError::Conflict("站台預設不可刪除".into()));
            }
            if t.status == TemplateStatus::Active {
                return Err(StoreError::Conflict("已發布的模板不可刪除,請先暫停".into()));
            }
        }
        for page in data.home_pages.values_mut() {
            if page.footer_template_id == Some(id) {
                page.footer_template_id = None;
            }
        }
        data.footers.remove(&id);
        Ok(())
    }

    async fn footer_audit(&self, tenant: Uuid, id: Uuid) -> StoreResult<Vec<AuditEntry>> {
        let data = self.inner.read().unwrap();
        let exists = data.footers.get(&id).is_some_and(|t| t.tenant_id == tenant);
        audit_of(&data.footer_audits, exists, id)
    }

    async fn site_default_footer_content(&self, tenant: Uuid) -> StoreResult<Value> {
        let data = self.inner.read().unwrap();
        let actives = || {
            data.footers
                .values()
                .filter(|t| t.tenant_id == tenant && t.status == TemplateStatus::Active)
        };
        let winner = actives()
            .find(|t| t.is_site_default)
            .or_else(|| actives().next());
        Ok(winner
            .map(|t| t.content.clone())
            .unwrap_or_else(|| json!([])))
    }
}

/// 套用首頁模板的 patch。可為 NULL 的欄位用雙層 Option 表達「不動 / 清空 / 設值」。
fn apply_home_page_patch(t: &mut HomePageTemplate, patch: HomePagePatch) -> StoreResult<()> {
    if let Some(name) = patch.name {
        t.name = clean_name(&name)?;
    }
    if let Some(seo_title) = patch.seo_title {
        t.seo_title = seo_title;
    }
    if let Some(seo_description) = patch.seo_description {
        t.seo_description = seo_description;
    }
    if let Some(targeting) = patch.targeting {
        t.targeting = targeting;
    }
    if let Some(header_template_id) = patch.header_template_id {
        t.header_template_id = header_template_id;
    }
    if let Some(footer_template_id) = patch.footer_template_id {
        t.footer_template_id = footer_template_id;
    }
    if let Some(content) = patch.content {
        t.content = content;
    }
    Ok(())
}
