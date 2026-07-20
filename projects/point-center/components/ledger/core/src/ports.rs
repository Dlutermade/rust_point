//! Outbound ports — 每個方法是一個**原子業務操作**:原子性與互斥由
//! adapter 內部保證,不外洩、不長時;商業規則([`deduct`](crate::deduct) 的
//! FIFO 分攤、[`RedemptionStatus`](crate::RedemptionStatus) 的狀態守衛)仍是
//! 本 crate 的純函式,由 adapter 在原子操作內呼叫。

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::deduction::DeductionError;
use crate::effective_window::EffectiveWindow;
use crate::redemption::{CancelReason, Redemption, Settlement};
use crate::redemption_status::RedemptionStatusError;
use crate::transaction_type::TransactionType;

/// 一個 chunk 的入帳:整塊共享 metadata,對象為該塊的 customer 清單。
#[derive(Debug, Clone)]
pub struct GrantBatch {
    pub shop_id: Uuid,
    pub issuance_id: Uuid,
    pub author: String,
    pub source_id: String,
    pub amount_per_recipient: i64,
    pub window: EffectiveWindow,
    pub customer_ids: Vec<Uuid>,
}

#[derive(Debug, thiserror::Error)]
pub enum GrantStoreError {
    #[error("storage failure: {0}")]
    Backend(String),
}

/// 入帳(`GrantPoints`):防重複過濾與冪等寫入在同一原子操作內。
#[async_trait]
pub trait GrantStore: Send + Sync {
    /// 回實際入帳人數;來源防重複略過者不計入。
    async fn grant_batch(&self, batch: &GrantBatch) -> Result<u64, GrantStoreError>;
}

/// 建立兌換所需的全部輸入;ID 與時鐘由呼叫端注入。
#[derive(Debug, Clone)]
pub struct NewRedemption {
    pub redemption_id: Uuid,
    pub shop_id: Uuid,
    pub customer_id: Uuid,
    pub author: String,
    pub source_id: String,
    pub amount: i64,
    pub settlement: Settlement,
    /// [`Settlement::Deferred`] 必填(= `now` + `holdTtlSeconds`,由 use case interactor 換算);[`Settlement::Immediate`] 為 `None`。
    pub hold_expires_at: Option<DateTime<Utc>>,
    pub now: DateTime<Utc>,
}

/// 預留/取消都回異動後餘額(API 回應需要)。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RedemptionOutcome {
    pub redemption: Redemption,
    pub balance: i64,
}

#[derive(Debug, thiserror::Error)]
pub enum ReserveError {
    /// 餘額不足 / 帳本損毀,由 [`deduct`](crate::deduct) 純函式判定。
    #[error(transparent)]
    Deduction(#[from] DeductionError),
    /// 同 shop 同客戶同來源已有一筆活的兌換;
    /// 重送 200 / 異參數 409 的判定由 use case interactor 重讀後決定。
    #[error("an active redemption already exists for this source")]
    SourceConflict,
    #[error("storage failure: {0}")]
    Backend(String),
}

#[derive(Debug, thiserror::Error)]
pub enum ConfirmError {
    #[error("redemption not found")]
    NotFound,
    #[error(transparent)]
    Status(#[from] RedemptionStatusError),
    #[error("storage failure: {0}")]
    Backend(String),
}

#[derive(Debug, thiserror::Error)]
pub enum CancelError {
    #[error("redemption not found")]
    NotFound,
    #[error(transparent)]
    Status(#[from] RedemptionStatusError),
    #[error("storage failure: {0}")]
    Backend(String),
}

#[derive(Debug, thiserror::Error)]
pub enum RedemptionStoreError {
    #[error("storage failure: {0}")]
    Backend(String),
}

/// 兌換生命週期(UC-2 + hold-timeout-job)。
///
/// `reserve` 的鎖策略(pessimistic / optimistic)是 adapter 實作的差異,
/// 由 composition root 依 `REDEEM_STRATEGY` 選擇注入,不作方法參數。
#[async_trait]
pub trait RedemptionStore: Send + Sync {
    /// 預留即扣點(FIFO 分攤);[`Settlement::Immediate`] 於同一原子操作內直接確認。
    async fn reserve(&self, reservation: NewRedemption) -> Result<RedemptionOutcome, ReserveError>;

    /// 重送 200 / 異參數 409 判定用:同 shop 同客戶同來源的「活的」一筆。
    async fn find_active_by_source(
        &self,
        shop_id: Uuid,
        customer_id: Uuid,
        author: &str,
        source_id: &str,
    ) -> Result<Option<Redemption>, RedemptionStoreError>;

    /// 定案:不動餘額、不寫交易,僅轉狀態。
    async fn confirm(
        &self,
        shop_id: Uuid,
        customer_id: Uuid,
        redemption_id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<Redemption, ConfirmError>;

    /// 取消:`release` 交易補回原批,並與 `points.redemption.cancelled`
    /// 事件同一原子操作(不丟事件,系統合約 C);主動與逾時同路徑。
    async fn cancel(
        &self,
        shop_id: Uuid,
        customer_id: Uuid,
        redemption_id: Uuid,
        reason: CancelReason,
        now: DateTime<Utc>,
    ) -> Result<RedemptionOutcome, CancelError>;

    /// `hold-timeout-job`:取消一批逾時預留。
    ///
    /// 重疊互斥的契約同 [`ExpiryStore::expire_due_chunk`],但互斥範圍獨立。
    async fn cancel_expired_holds(
        &self,
        now: DateTime<Utc>,
        chunk_size: u32,
    ) -> Result<SweepOutcome, RedemptionStoreError>;
}

/// 一次清掃塊的結局;鎖被其他 runner 持有時**立刻讓路**,不等待。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SweepOutcome {
    /// 本塊處理數;0 = 已無待處理項,本輪清掃完成。
    Swept { count: u64 },
    /// 另一個 runner 正在清掃(互斥未取得)。
    AnotherSweeperActive,
}

#[derive(Debug, thiserror::Error)]
pub enum ExpiryStoreError {
    #[error("storage failure: {0}")]
    Backend(String),
}

/// 到期清掃(`ExpirePoints`,`expiry-job`):每塊的歸零、`expire` 留痕與
/// `points.batch.expired` 事件為同一原子操作,不丟事件。
#[async_trait]
pub trait ExpiryStore: Send + Sync {
    /// 清掃一塊過期批次(歸零 + expire 交易 + 事件)。
    ///
    /// 重疊互斥由 adapter 保證:互斥的生命週期不超過本次原子操作、
    /// 拿不到立刻讓路(不等待);正確性由冪等兜底,互斥只省重工。
    async fn expire_due_chunk(
        &self,
        now: DateTime<Utc>,
        chunk_size: u32,
    ) -> Result<SweepOutcome, ExpiryStoreError>;
}

#[derive(Debug, Clone, Copy)]
pub struct Page {
    pub limit: u32,
    pub offset: u32,
}

/// UC-3 read model:餘額 + 持有批次(依到期升冪,與 FIFO 一致)。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CustomerPointsView {
    pub balance: i64,
    pub batches: Vec<PointBatchView>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PointBatchView {
    pub customer_point_id: Uuid,
    pub original_amount: i64,
    pub remaining_amount: i64,
    pub effective_at: DateTime<Utc>,
    /// `None` = 永久(API 回 `null`、排最後)。
    pub expires_at: Option<DateTime<Utc>>,
}

/// UC-4 read model:新到舊分頁。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TransactionsPage {
    pub total: u64,
    pub entries: Vec<TransactionView>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TransactionView {
    pub transaction_id: Uuid,
    pub transaction_type: TransactionType,
    pub amount_change: i64,
    pub author: String,
    pub source_id: String,
    pub occurred_at: DateTime<Utc>,
    /// 兌換(`redeem` / `release`)的扣減明細;其餘類型為空。
    pub deductions: Vec<DeductionView>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeductionView {
    pub customer_point_id: Uuid,
    pub amount: i64,
}

#[derive(Debug, thiserror::Error)]
pub enum LedgerQueryError {
    #[error("storage failure: {0}")]
    Backend(String),
}

/// 讀側(UC-3/4):直投影 Read Model,無鎖無交易,拿不到可變聚合。
#[async_trait]
pub trait LedgerQueries: Send + Sync {
    async fn customer_points_view(
        &self,
        shop_id: Uuid,
        customer_id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<CustomerPointsView, LedgerQueryError>;

    async fn transactions_page(
        &self,
        shop_id: Uuid,
        customer_id: Uuid,
        page: Page,
    ) -> Result<TransactionsPage, LedgerQueryError>;
}
