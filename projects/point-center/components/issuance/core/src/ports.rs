//! Outbound ports — 每個方法是一個**原子業務操作**:原子性由 adapter
//! 內部保證,不外洩、不長時;狀態轉移守衛與換算仍是本 crate 的純函式。

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use futures::stream::BoxStream;
use point_center_ledger_core::EffectiveWindow;
use uuid::Uuid;

use crate::issuance::{FailureReason, Issuance};

#[derive(Debug, thiserror::Error)]
pub enum IssuanceRepositoryError {
    #[error("an active issuance already exists for this source")]
    SourceConflict,
    #[error("storage failure: {0}")]
    Backend(String),
}

/// 聚合持久化;重送 200 / 異參數 409 的判定由 use case interactor 讀後決定。
#[async_trait]
pub trait IssuanceRepository: Send + Sync {
    async fn insert(&self, issuance: &Issuance) -> Result<(), IssuanceRepositoryError>;

    async fn find(
        &self,
        shop_id: Uuid,
        issuance_id: Uuid,
    ) -> Result<Option<Issuance>, IssuanceRepositoryError>;

    /// 同 shop 同來源的「活的」一筆(cancelled 不算)。
    async fn find_active_by_source(
        &self,
        shop_id: Uuid,
        author: &str,
        source_id: &str,
    ) -> Result<Option<Issuance>, IssuanceRepositoryError>;

    async fn update(&self, issuance: &Issuance) -> Result<(), IssuanceRepositoryError>;

    /// worker 進度計數:高頻原子累加,不經聚合(UC-5 的進度來源)。
    async fn advance_progress(
        &self,
        issuance_id: Uuid,
        processed_delta: u64,
        granted_delta: u64,
    ) -> Result<(), IssuanceRepositoryError>;
}

/// part 檔的定位:`{issuance_id}/{upload_id}/part-{part_number:05}`。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PartLocation {
    pub issuance_id: Uuid,
    pub upload_id: Uuid,
    pub part_number: u32,
}

#[derive(Debug, thiserror::Error)]
pub enum RecipientListStoreError {
    #[error("recipient list not found at {uri}")]
    NotFound { uri: String },
    #[error("recipient list corrupted: {detail}")]
    Corrupted { detail: String },
    #[error("storage failure: {0}")]
    Backend(String),
}

/// 名單儲存(v1 `file://` → 正式 `gs://`);兩向串流,記憶體 O(chunk)。
#[async_trait]
pub trait RecipientListStore: Send + Sync {
    /// 追加一個 part 檔(內容為已驗證的完整行);分片邊界由上傳命令決定。
    async fn append_part(
        &self,
        location: PartLocation,
        customer_ids: Vec<Uuid>,
    ) -> Result<(), RecipientListStoreError>;

    /// 收尾:回這份清單的不可變 URI(自此只讀)。
    async fn finalize(
        &self,
        issuance_id: Uuid,
        upload_id: Uuid,
    ) -> Result<String, RecipientListStoreError>;

    /// 依 part 序逐行讀(`grant-worker` 與 UC-6 下載共用)。
    fn stream_customer_ids(
        &self,
        uri: &str,
    ) -> BoxStream<'static, Result<Uuid, RecipientListStoreError>>;
}

/// `:issue` 發布的入帳任務(一次發點 = 一個任務;清單走 URI 不塞訊息)。
#[derive(Debug, Clone)]
pub struct IssuanceTask {
    pub shop_id: Uuid,
    pub issuance_id: Uuid,
    pub author: String,
    pub source_id: String,
    pub amount_per_recipient: i64,
    pub window: EffectiveWindow,
    pub recipients_uri: String,
    pub recipient_count: u64,
}

/// `points.issuance.completed.{author}` 的 payload 來源。
#[derive(Debug, Clone)]
pub struct IssuanceCompleted {
    pub shop_id: Uuid,
    pub issuance_id: Uuid,
    pub author: String,
    pub source_id: String,
    pub recipient_count: u64,
    pub processed_count: u64,
    pub granted_count: u64,
    pub completed_at: DateTime<Utc>,
}

/// `points.issuance.failed.{author}` 的 payload 來源(重試後再失敗會再發)。
#[derive(Debug, Clone)]
pub struct IssuanceFailed {
    pub shop_id: Uuid,
    pub issuance_id: Uuid,
    pub author: String,
    pub source_id: String,
    pub recipient_count: u64,
    pub processed_count: u64,
    pub granted_count: u64,
    pub failure_reason: FailureReason,
    pub failed_at: DateTime<Utc>,
}

#[derive(Debug, thiserror::Error)]
pub enum IssuanceEventError {
    #[error("event publish failure: {0}")]
    Backend(String),
}

/// 任務與終態事件的發布(NATS);消費迴圈與 ack 屬 shell + adapter,
/// core 只回傳處理結局。
#[async_trait]
pub trait IssuanceEventPort: Send + Sync {
    async fn publish_task(&self, task: IssuanceTask) -> Result<(), IssuanceEventError>;
    async fn publish_completed(&self, event: IssuanceCompleted) -> Result<(), IssuanceEventError>;
    async fn publish_failed(&self, event: IssuanceFailed) -> Result<(), IssuanceEventError>;
}
