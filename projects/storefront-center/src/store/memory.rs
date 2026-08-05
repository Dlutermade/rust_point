//! 記憶體 store(開發用,不接 DB)。狀態機 / 不可變性規則都在這:
//! 已發布凍結、常態版不可暫停 / 刪除、每版位至多一個站台預設。
//! 之後換 Postgres adapter 時,這些規則搬到 SQL / 交易裡,API 層不動。

use std::cmp::Reverse;
use std::collections::HashMap;
use std::sync::RwLock;

use async_trait::async_trait;
use serde_json::{Value, json};
use time::OffsetDateTime;
use time::macros::datetime;
use uuid::Uuid;

use super::{DraftPatch, PublishPatch, Store, StoreError, StoreResult};
use crate::domain::{AuditAction, AuditEntry, Slot, Template, TemplateStatus};

/// 單一預設租戶(多租戶解析 stub 期間,所有請求都掛在這底下)。
pub const DEFAULT_TENANT: Uuid = Uuid::from_u128(0x0000_0000_0000_7000_8000_0000_0000_0001);

struct Data {
    templates: HashMap<Uuid, Template>,
    audit: Vec<AuditEntry>,
}

pub struct InMemoryStore {
    inner: RwLock<Data>,
}

impl InMemoryStore {
    /// 帶種子資料(一個租戶 + 幾個模板),讓 API 一起手就有東西可回。
    pub fn seeded() -> Self {
        let mut templates = HashMap::new();
        let t = DEFAULT_TENANT;
        let mut add = |tpl: Template| {
            templates.insert(tpl.id, tpl);
        };

        add(seed(
            t,
            Slot::Home,
            "預設首頁",
            TemplateStatus::Active,
            true,
            json!({}),
            datetime!(2026-07-20 14:05 UTC),
            Some("常態版(永久兜底)"),
        ));
        add(seed(
            t,
            Slot::Home,
            "周年慶首頁",
            TemplateStatus::Active,
            false,
            json!({
                "schedule": { "start": "2026-08-01T00:00:00+08:00", "end": "2026-08-14T23:59:59+08:00" },
                "priority": 100
            }),
            datetime!(2026-07-24 09:30 UTC),
            Some("檔期 8/1–8/14"),
        ));
        add(seed(
            t,
            Slot::Home,
            "實驗版 A",
            TemplateStatus::Draft,
            false,
            json!({}),
            datetime!(2026-07-25 18:12 UTC),
            None,
        ));
        add(seed(
            t,
            Slot::Header,
            "預設頁首",
            TemplateStatus::Active,
            true,
            json!({}),
            datetime!(2026-07-20 14:05 UTC),
            Some("常態版"),
        ));
        add(seed(
            t,
            Slot::Header,
            "促銷頁首",
            TemplateStatus::Active,
            false,
            json!({}),
            datetime!(2026-07-28 10:00 UTC),
            Some("另一版外框,可設為站台預設"),
        ));
        add(seed(
            t,
            Slot::Footer,
            "預設頁尾",
            TemplateStatus::Active,
            true,
            json!({}),
            datetime!(2026-07-20 14:05 UTC),
            Some("常態版"),
        ));

        Self {
            inner: RwLock::new(Data {
                templates,
                audit: Vec::new(),
            }),
        }
    }
}

/// 建一個種子模板。欄位平鋪比包一層 struct 直白;PG adapter 進場後整塊會消失。
#[allow(clippy::too_many_arguments)]
fn seed(
    tenant_id: Uuid,
    slot: Slot,
    name: &str,
    status: TemplateStatus,
    is_default: bool,
    targeting: Value,
    updated_at: OffsetDateTime,
    note: Option<&str>,
) -> Template {
    let published = matches!(status, TemplateStatus::Active | TemplateStatus::Paused);
    Template {
        id: Uuid::now_v7(),
        tenant_id,
        slot,
        name: name.to_string(),
        status,
        is_default,
        targeting,
        chrome: json!({}),
        content: json!([]),
        version: if published { 1 } else { 0 },
        note: note.map(str::to_string),
        updated_at,
        published_at: published.then_some(updated_at),
    }
}

impl Data {
    /// 取某租戶的模板(可變);租戶不符或不存在 → NotFound。
    fn get_owned(&mut self, tenant: Uuid, id: Uuid) -> StoreResult<&mut Template> {
        match self.templates.get_mut(&id) {
            Some(t) if t.tenant_id == tenant => Ok(t),
            _ => Err(StoreError::NotFound),
        }
    }

    fn log(&mut self, template_id: Uuid, action: AuditAction, detail: Option<String>) {
        self.audit.push(AuditEntry {
            id: Uuid::now_v7(),
            template_id,
            action,
            detail,
            at: OffsetDateTime::now_utc(),
        });
    }
}

#[async_trait]
impl Store for InMemoryStore {
    async fn list(&self, tenant: Uuid, slot: Slot) -> StoreResult<Vec<Template>> {
        let data = self.inner.read().unwrap();
        let mut out: Vec<Template> = data
            .templates
            .values()
            .filter(|t| t.tenant_id == tenant && t.slot == slot)
            .cloned()
            .collect();
        // 常態版排最後、其餘依更新時間新到舊 —— 給列表穩定順序。
        out.sort_by(|a, b| {
            a.is_default
                .cmp(&b.is_default)
                .then(b.updated_at.cmp(&a.updated_at))
        });
        Ok(out)
    }

    async fn get(&self, tenant: Uuid, id: Uuid) -> StoreResult<Template> {
        let data = self.inner.read().unwrap();
        data.templates
            .get(&id)
            .filter(|t| t.tenant_id == tenant)
            .cloned()
            .ok_or(StoreError::NotFound)
    }

    async fn create_draft(&self, tenant: Uuid, slot: Slot, name: String) -> StoreResult<Template> {
        let name = name.trim();
        if name.is_empty() {
            return Err(StoreError::BadRequest("名稱不可為空".into()));
        }
        let tpl = Template {
            id: Uuid::now_v7(),
            tenant_id: tenant,
            slot,
            name: name.to_string(),
            status: TemplateStatus::Draft,
            is_default: false,
            targeting: json!({}),
            chrome: json!({}),
            content: json!([]),
            version: 0,
            note: None,
            updated_at: OffsetDateTime::now_utc(),
            published_at: None,
        };
        let mut data = self.inner.write().unwrap();
        data.log(tpl.id, AuditAction::Create, None);
        data.templates.insert(tpl.id, tpl.clone());
        Ok(tpl)
    }

    async fn save_draft(&self, tenant: Uuid, id: Uuid, patch: DraftPatch) -> StoreResult<Template> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.get_owned(tenant, id)?;
            if t.status != TemplateStatus::Draft {
                return Err(StoreError::Conflict(
                    "已發布的模板不可修改,請複製一份再編輯".into(),
                ));
            }
            if let Some(name) = patch.name {
                let name = name.trim();
                if name.is_empty() {
                    return Err(StoreError::BadRequest("名稱不可為空".into()));
                }
                t.name = name.to_string();
            }
            if let Some(content) = patch.content {
                t.content = content;
            }
            if let Some(targeting) = patch.targeting {
                t.targeting = targeting;
            }
            if let Some(chrome) = patch.chrome {
                t.chrome = chrome;
            }
            t.updated_at = OffsetDateTime::now_utc();
        }
        data.log(id, AuditAction::SaveDraft, None);
        Ok(data.templates[&id].clone())
    }

    async fn publish(&self, tenant: Uuid, id: Uuid, patch: PublishPatch) -> StoreResult<Template> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.get_owned(tenant, id)?;
            if t.status != TemplateStatus::Draft {
                return Err(StoreError::Conflict("只有草稿可以發布".into()));
            }
            if let Some(content) = patch.content {
                t.content = content;
            }
            if let Some(targeting) = patch.targeting {
                t.targeting = targeting;
            }
            let now = OffsetDateTime::now_utc();
            t.status = TemplateStatus::Active;
            t.version += 1;
            t.updated_at = now;
            t.published_at = Some(now);
        }
        data.log(id, AuditAction::Publish, None);
        Ok(data.templates[&id].clone())
    }

    async fn set_priority(&self, tenant: Uuid, id: Uuid, priority: i64) -> StoreResult<Template> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.get_owned(tenant, id)?;
            if !t.targeting.is_object() {
                t.targeting = json!({});
            }
            t.targeting["priority"] = json!(priority);
            t.updated_at = OffsetDateTime::now_utc();
        }
        data.log(id, AuditAction::Priority, Some(priority.to_string()));
        Ok(data.templates[&id].clone())
    }

    async fn set_paused(&self, tenant: Uuid, id: Uuid, paused: bool) -> StoreResult<Template> {
        let mut data = self.inner.write().unwrap();
        let action;
        {
            let t = data.get_owned(tenant, id)?;
            if paused {
                if t.is_default {
                    return Err(StoreError::Conflict("常態版 / 站台預設不可暫停".into()));
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
        data.log(id, action, None);
        Ok(data.templates[&id].clone())
    }

    async fn set_default(&self, tenant: Uuid, id: Uuid) -> StoreResult<Template> {
        let mut data = self.inner.write().unwrap();
        let slot = {
            let t = data.get_owned(tenant, id)?;
            if !t.slot.is_chrome() {
                return Err(StoreError::BadRequest("只有頁首 / 頁尾能設站台預設".into()));
            }
            if t.status != TemplateStatus::Active {
                return Err(StoreError::Conflict("只有已發布的模板能設站台預設".into()));
            }
            t.slot
        };
        // 同版位其餘取消預設,目標設為預設。
        for other in data.templates.values_mut() {
            if other.tenant_id == tenant && other.slot == slot {
                other.is_default = other.id == id;
            }
        }
        if let Some(t) = data.templates.get_mut(&id) {
            t.updated_at = OffsetDateTime::now_utc();
        }
        data.log(id, AuditAction::SetDefault, None);
        Ok(data.templates[&id].clone())
    }

    async fn remove(&self, tenant: Uuid, id: Uuid) -> StoreResult<()> {
        let mut data = self.inner.write().unwrap();
        {
            let t = data.get_owned(tenant, id)?;
            if t.is_default {
                return Err(StoreError::Conflict("常態版 / 站台預設不可刪除".into()));
            }
            if t.status == TemplateStatus::Active {
                return Err(StoreError::Conflict("已發布的模板不可刪除,請先暫停".into()));
            }
        }
        data.templates.remove(&id);
        Ok(())
    }

    async fn audit(&self, tenant: Uuid, id: Uuid) -> StoreResult<Vec<AuditEntry>> {
        let data = self.inner.read().unwrap();
        // 確認模板存在且屬於此租戶(已刪除的就查不到)。
        if !data
            .templates
            .get(&id)
            .is_some_and(|t| t.tenant_id == tenant)
        {
            return Err(StoreError::NotFound);
        }
        let mut out: Vec<AuditEntry> = data
            .audit
            .iter()
            .filter(|a| a.template_id == id)
            .cloned()
            .collect();
        out.sort_by_key(|a| Reverse(a.at));
        Ok(out)
    }

    async fn active_content(&self, tenant: Uuid, slot: Slot) -> StoreResult<Value> {
        let data = self.inner.read().unwrap();
        let actives = || {
            data.templates.values().filter(|t| {
                t.tenant_id == tenant && t.slot == slot && t.status == TemplateStatus::Active
            })
        };
        let winner = actives()
            .find(|t| t.is_default)
            .or_else(|| actives().next());
        Ok(winner
            .map(|t| t.content.clone())
            .unwrap_or_else(|| json!([])))
    }
}
