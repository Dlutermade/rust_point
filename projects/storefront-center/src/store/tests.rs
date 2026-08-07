//! `InMemoryStore` 的狀態機與不變式測試。
//!
//! 這裡測的是**規則**不是實作:已發布凍結、常態版 / 站台預設不可暫停或刪除、
//! 站台預設同租戶唯一、租戶隔離。PG adapter 進場後這些規則搬進 SQL / 交易,
//! 同一組測試要能對著新 adapter 再跑一次(屆時把 `store()` 換成建 PG store 即可)。

use serde_json::json;
use uuid::Uuid;

use super::*;
use crate::domain::{AuditAction, TemplateStatus};

fn store() -> InMemoryStore {
    InMemoryStore::seeded()
}

/// 種子裡那份常態版首頁。
async fn fallback_home_page(s: &InMemoryStore) -> Uuid {
    s.list_home_pages(DEFAULT_TENANT)
        .await
        .unwrap()
        .into_iter()
        .find(|t| t.is_fallback)
        .expect("種子應有一份常態版")
        .id
}

/// 種子裡任一份已發布(非常態版)的首頁。
async fn published_home_page(s: &InMemoryStore) -> Uuid {
    s.list_home_pages(DEFAULT_TENANT)
        .await
        .unwrap()
        .into_iter()
        .find(|t| t.status == TemplateStatus::Active && !t.is_fallback)
        .expect("種子應有一份已發布的非常態版")
        .id
}

async fn site_default_header(s: &InMemoryStore) -> Uuid {
    s.list_headers(DEFAULT_TENANT)
        .await
        .unwrap()
        .into_iter()
        .find(|t| t.is_site_default)
        .expect("種子應有一份站台預設頁首")
        .id
}

// ── 已發布凍結 ──────────────────────────────────────────────────────────

#[tokio::test]
async fn published_home_page_cannot_be_edited() {
    let s = store();
    let id = published_home_page(&s).await;

    let err = s
        .save_home_page_draft(
            DEFAULT_TENANT,
            id,
            HomePagePatch {
                name: Some("改名".into()),
                ..Default::default()
            },
        )
        .await
        .unwrap_err();

    assert!(matches!(err, StoreError::Conflict(_)));
}

#[tokio::test]
async fn only_draft_can_be_published() {
    let s = store();
    let id = published_home_page(&s).await;

    let err = s
        .publish_home_page(DEFAULT_TENANT, id, HomePagePatch::default())
        .await
        .unwrap_err();

    assert!(matches!(err, StoreError::Conflict(_)));
}

// ── 發布一次帶齊(舊 PublishPatch 太窄的回歸測試) ─────────────────────────

#[tokio::test]
async fn publish_accepts_every_editable_field_in_one_call() {
    let s = store();
    let header = site_default_header(&s).await;
    let draft = s
        .create_home_page_draft(DEFAULT_TENANT, "新頁".into())
        .await
        .unwrap();

    let published = s
        .publish_home_page(
            DEFAULT_TENANT,
            draft.id,
            HomePagePatch {
                name: Some("新頁 定稿".into()),
                seo_title: Some(Some("標題".into())),
                header_template_id: Some(Some(header)),
                content: Some(json!([{ "id": "b1", "type": "text" }])),
                ..Default::default()
            },
        )
        .await
        .unwrap();

    assert_eq!(published.name, "新頁 定稿");
    assert_eq!(published.seo_title.as_deref(), Some("標題"));
    assert_eq!(published.header_template_id, Some(header));
    assert_eq!(published.status, TemplateStatus::Active);
    assert_eq!(published.version, 1);

    // 關鍵:發布不必先繞一趟 save-draft,所以審計裡不該出現多餘的那一筆。
    let audit = s
        .home_page_audit(DEFAULT_TENANT, draft.id)
        .await
        .unwrap()
        .into_iter()
        .map(|a| a.action)
        .collect::<Vec<_>>();
    assert_eq!(audit, vec![AuditAction::Publish, AuditAction::Create]);
}

// ── patch 三態:不動 / 設值 / 清空 ───────────────────────────────────────

#[tokio::test]
async fn patch_distinguishes_absent_from_null() {
    let s = store();
    let header = site_default_header(&s).await;
    let draft = s
        .create_home_page_draft(DEFAULT_TENANT, "三態".into())
        .await
        .unwrap();

    // 設值
    let t = s
        .save_home_page_draft(
            DEFAULT_TENANT,
            draft.id,
            HomePagePatch {
                header_template_id: Some(Some(header)),
                ..Default::default()
            },
        )
        .await
        .unwrap();
    assert_eq!(t.header_template_id, Some(header));

    // 欄位沒出現 → 不動
    let t = s
        .save_home_page_draft(
            DEFAULT_TENANT,
            draft.id,
            HomePagePatch {
                name: Some("只改名".into()),
                ..Default::default()
            },
        )
        .await
        .unwrap();
    assert_eq!(t.header_template_id, Some(header), "沒帶的欄位不該被動到");

    // 明確給 null → 清空(改回跟隨站台預設)
    let t = s
        .save_home_page_draft(
            DEFAULT_TENANT,
            draft.id,
            HomePagePatch {
                header_template_id: Some(None),
                ..Default::default()
            },
        )
        .await
        .unwrap();
    assert_eq!(t.header_template_id, None);
}

// ── 兜底不可消失 ────────────────────────────────────────────────────────

#[tokio::test]
async fn fallback_home_page_cannot_be_paused_or_removed() {
    let s = store();
    let id = fallback_home_page(&s).await;

    assert!(matches!(
        s.set_home_page_paused(DEFAULT_TENANT, id, true)
            .await
            .unwrap_err(),
        StoreError::Conflict(_)
    ));
    assert!(matches!(
        s.remove_home_page(DEFAULT_TENANT, id).await.unwrap_err(),
        StoreError::Conflict(_)
    ));
}

#[tokio::test]
async fn site_default_header_cannot_be_paused_or_removed() {
    let s = store();
    let id = site_default_header(&s).await;

    assert!(matches!(
        s.set_header_paused(DEFAULT_TENANT, id, true)
            .await
            .unwrap_err(),
        StoreError::Conflict(_)
    ));
    assert!(matches!(
        s.remove_header(DEFAULT_TENANT, id).await.unwrap_err(),
        StoreError::Conflict(_)
    ));
}

// ── 站台預設同租戶唯一 ──────────────────────────────────────────────────

#[tokio::test]
async fn setting_site_default_clears_the_previous_one() {
    let s = store();
    let old = site_default_header(&s).await;
    let other = s
        .list_headers(DEFAULT_TENANT)
        .await
        .unwrap()
        .into_iter()
        .find(|t| !t.is_site_default && t.status == TemplateStatus::Active)
        .expect("種子應有第二份已發布頁首")
        .id;

    s.set_header_site_default(DEFAULT_TENANT, other)
        .await
        .unwrap();

    let defaults: Vec<Uuid> = s
        .list_headers(DEFAULT_TENANT)
        .await
        .unwrap()
        .into_iter()
        .filter(|t| t.is_site_default)
        .map(|t| t.id)
        .collect();
    assert_eq!(defaults, vec![other], "站台預設同租戶只能有一份");
    assert_ne!(defaults[0], old);
}

#[tokio::test]
async fn draft_cannot_become_site_default() {
    let s = store();
    let draft = s
        .create_header_draft(DEFAULT_TENANT, "草稿頁首".into())
        .await
        .unwrap();

    assert!(matches!(
        s.set_header_site_default(DEFAULT_TENANT, draft.id)
            .await
            .unwrap_err(),
        StoreError::Conflict(_)
    ));
}

// ── 刪除外框時,引用它的首頁要退回跟隨站台預設 ───────────────────────────

#[tokio::test]
async fn removing_a_header_clears_pages_that_reference_it() {
    let s = store();
    let header = s
        .create_header_draft(DEFAULT_TENANT, "待刪".into())
        .await
        .unwrap();
    let page = s
        .create_home_page_draft(DEFAULT_TENANT, "引用者".into())
        .await
        .unwrap();
    s.save_home_page_draft(
        DEFAULT_TENANT,
        page.id,
        HomePagePatch {
            header_template_id: Some(Some(header.id)),
            ..Default::default()
        },
    )
    .await
    .unwrap();

    s.remove_header(DEFAULT_TENANT, header.id).await.unwrap();

    let page = s.get_home_page(DEFAULT_TENANT, page.id).await.unwrap();
    assert_eq!(
        page.header_template_id, None,
        "被刪掉的外框不該留下懸空引用"
    );
}

// ── 複製 ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn duplicate_starts_as_a_plain_draft() {
    let s = store();
    let source_id = fallback_home_page(&s).await;
    let source = s.get_home_page(DEFAULT_TENANT, source_id).await.unwrap();

    let copy = s
        .duplicate_home_page(DEFAULT_TENANT, source_id)
        .await
        .unwrap();

    assert_ne!(copy.id, source.id);
    assert_eq!(copy.status, TemplateStatus::Draft);
    assert_eq!(copy.version, 0);
    assert!(copy.published_at.is_none());
    assert!(!copy.is_fallback, "複本不該繼承常態版身分(每租戶只能一份)");
    assert_eq!(copy.content, source.content, "內容要一起帶過去");
}

#[tokio::test]
async fn duplicated_header_is_not_site_default() {
    let s = store();
    let id = site_default_header(&s).await;

    let copy = s.duplicate_header(DEFAULT_TENANT, id).await.unwrap();

    assert!(!copy.is_site_default);
    assert_eq!(copy.status, TemplateStatus::Draft);
}

// ── 租戶隔離 ────────────────────────────────────────────────────────────

#[tokio::test]
async fn other_tenants_cannot_reach_this_tenants_templates() {
    let s = store();
    let id = fallback_home_page(&s).await;
    let intruder = Uuid::from_u128(0xdead_beef);

    assert!(matches!(
        s.get_home_page(intruder, id).await.unwrap_err(),
        StoreError::NotFound
    ));
    assert!(matches!(
        s.remove_home_page(intruder, id).await.unwrap_err(),
        StoreError::NotFound
    ));
    assert!(matches!(
        s.home_page_audit(intruder, id).await.unwrap_err(),
        StoreError::NotFound
    ));
    assert!(s.list_home_pages(intruder).await.unwrap().is_empty());
}

// ── 名稱驗證 ────────────────────────────────────────────────────────────

#[tokio::test]
async fn blank_name_is_rejected() {
    let s = store();

    assert!(matches!(
        s.create_home_page_draft(DEFAULT_TENANT, "   ".into())
            .await
            .unwrap_err(),
        StoreError::BadRequest(_)
    ));
}

// ── 站台預設內容(編輯器預覽外框用) ──────────────────────────────────────

#[tokio::test]
async fn site_default_content_follows_the_current_default() {
    let s = store();
    let draft = s
        .create_header_draft(DEFAULT_TENANT, "新版頁首".into())
        .await
        .unwrap();
    let content = json!([{ "id": "logo", "type": "image" }]);
    s.publish_header(
        DEFAULT_TENANT,
        draft.id,
        HeaderPatch {
            content: Some(content.clone()),
            ..Default::default()
        },
    )
    .await
    .unwrap();
    s.set_header_site_default(DEFAULT_TENANT, draft.id)
        .await
        .unwrap();

    assert_eq!(
        s.site_default_header_content(DEFAULT_TENANT).await.unwrap(),
        content
    );
}
