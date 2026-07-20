use chrono::{DateTime, Utc};
use point_center_ledger_core::EffectiveWindow;
use uuid::Uuid;

use crate::expiration_policy::{ExpirationPolicy, ExpirationPolicyError};
use crate::issuance_status::{IssuanceStatus, IssuanceStatusError};

/// Everything needed to create a draft issuance. IDs are caller-generated
/// (UUID v7) and the clock is injected — core reads neither.
#[derive(Debug, Clone)]
pub struct NewIssuance {
    pub issuance_id: Uuid,
    pub shop_id: Uuid,
    pub author: String,
    pub source_id: String,
    pub amount_per_recipient: i64,
    pub expiration: ExpirationPolicy,
    pub effective_at: Option<DateTime<Utc>>,
}

/// `failed` 的結構化原因;與 API 錯誤同形(`{code, message}`)。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FailureReason {
    pub code: String,
    pub message: String,
}

/// 現行上傳 session(GCS resumable dialect 的持久化側)。
/// 欄位成對成立:計數只隨 session 存在——restore 邊界上半缺不可表示。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UploadSession {
    pub upload_id: Uuid,
    /// 已持久化的完整行數。
    pub uploaded_count: u64,
    /// 續傳 Range 的真相來源。
    pub uploaded_bytes: u64,
}

/// finalize 後鎖定的清單快照;URI 與行數成對成立。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecipientList {
    pub uri: String,
    pub count: u64,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum IssuanceError {
    #[error("amount_per_recipient must be positive, got {0}")]
    NonPositiveAmountPerRecipient(i64),
    #[error(transparent)]
    ExpirationPolicy(#[from] ExpirationPolicyError),
    #[error(transparent)]
    Status(#[from] IssuanceStatusError),
    #[error("no open upload session")]
    NoOpenUploadSession,
    #[error("uploaded_bytes must not regress: current {current_bytes}, got {new_bytes}")]
    UploadBytesRegression { current_bytes: u64, new_bytes: u64 },
    #[error("recipient list is not finalized")]
    RecipientListNotFinalized,
    #[error("recipient list is empty")]
    EmptyRecipientList,
}

/// Issuance aggregate — the single writer of its own state. `status` is
/// private and every mutation goes through the [`IssuanceStatus`] guards,
/// so an illegal transition cannot be expressed by callers.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Issuance {
    issuance_id: Uuid,
    shop_id: Uuid,
    author: String,
    source_id: String,
    amount_per_recipient: i64,
    window: EffectiveWindow,
    status: IssuanceStatus,
    upload: Option<UploadSession>,
    recipients: Option<RecipientList>,
    failure_reason: Option<FailureReason>,
    created_at: DateTime<Utc>,
    issued_at: Option<DateTime<Utc>>,
    completed_at: Option<DateTime<Utc>>,
    cancelled_at: Option<DateTime<Utc>>,
}

/// 自可信儲存重建聚合的欄位集(不重跑不變量;不變量由寫入路徑保證)。
#[derive(Debug, Clone)]
pub struct StoredIssuance {
    pub issuance_id: Uuid,
    pub shop_id: Uuid,
    pub author: String,
    pub source_id: String,
    pub amount_per_recipient: i64,
    pub window: EffectiveWindow,
    pub status: IssuanceStatus,
    pub upload: Option<UploadSession>,
    pub recipients: Option<RecipientList>,
    pub failure_reason: Option<FailureReason>,
    pub created_at: DateTime<Utc>,
    pub issued_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
}

impl Issuance {
    /// 建立草稿:驗證面額、換算生效窗(`now` 注入)。
    pub fn create(new_issuance: NewIssuance, now: DateTime<Utc>) -> Result<Self, IssuanceError> {
        if new_issuance.amount_per_recipient <= 0 {
            return Err(IssuanceError::NonPositiveAmountPerRecipient(
                new_issuance.amount_per_recipient,
            ));
        }
        let window = new_issuance
            .expiration
            .resolve(new_issuance.effective_at, now)?;

        Ok(Self {
            issuance_id: new_issuance.issuance_id,
            shop_id: new_issuance.shop_id,
            author: new_issuance.author,
            source_id: new_issuance.source_id,
            amount_per_recipient: new_issuance.amount_per_recipient,
            window,
            status: IssuanceStatus::Draft,
            upload: None,
            recipients: None,
            failure_reason: None,
            created_at: now,
            issued_at: None,
            completed_at: None,
            cancelled_at: None,
        })
    }

    pub fn restore(stored: StoredIssuance) -> Self {
        Self {
            issuance_id: stored.issuance_id,
            shop_id: stored.shop_id,
            author: stored.author,
            source_id: stored.source_id,
            amount_per_recipient: stored.amount_per_recipient,
            window: stored.window,
            status: stored.status,
            upload: stored.upload,
            recipients: stored.recipients,
            failure_reason: stored.failure_reason,
            created_at: stored.created_at,
            issued_at: stored.issued_at,
            completed_at: stored.completed_at,
            cancelled_at: stored.cancelled_at,
        }
    }

    /// 開新上傳 session(僅 `draft` / `failed`):一個 session = 一份完整清單,
    /// 舊 session 與已 finalize 的清單一併作廢(檔案保留,不再引用)。
    pub fn start_upload_session(&mut self, upload_id: Uuid) -> Result<(), IssuanceError> {
        self.status.validate_recipients_upload()?;
        self.upload = Some(UploadSession {
            upload_id,
            uploaded_count: 0,
            uploaded_bytes: 0,
        });
        self.recipients = None;
        Ok(())
    }

    /// 記錄一塊落地:行數累加、位元組前推(單調,不可回退)。
    /// Range 協定的塊檢核在 delivery 層;這裡只守聚合不變量。
    pub fn advance_upload(
        &mut self,
        appended_count: u64,
        uploaded_bytes: u64,
    ) -> Result<(), IssuanceError> {
        self.status.validate_recipients_upload()?;
        let session = self
            .upload
            .as_mut()
            .ok_or(IssuanceError::NoOpenUploadSession)?;
        if uploaded_bytes < session.uploaded_bytes {
            return Err(IssuanceError::UploadBytesRegression {
                current_bytes: session.uploaded_bytes,
                new_bytes: uploaded_bytes,
            });
        }
        session.uploaded_count += appended_count;
        session.uploaded_bytes = uploaded_bytes;
        Ok(())
    }

    /// 最後一塊收訖:以現行 session 的行數鎖定清單快照。
    pub fn finalize_upload(&mut self, recipients_uri: String) -> Result<(), IssuanceError> {
        self.status.validate_recipients_upload()?;
        let session = self
            .upload
            .as_ref()
            .ok_or(IssuanceError::NoOpenUploadSession)?;
        self.recipients = Some(RecipientList {
            uri: recipients_uri,
            count: session.uploaded_count,
        });
        Ok(())
    }

    /// `:issue`:清單須已 finalize 且非空;首次送出記 `issued_at`,
    /// 重試不改寫;重新入列即清除上一輪失敗原因。
    pub fn issue(&mut self, now: DateTime<Utc>) -> Result<(), IssuanceError> {
        let next_status = self.status.issue()?;
        let recipients = self
            .recipients
            .as_ref()
            .ok_or(IssuanceError::RecipientListNotFinalized)?;
        if recipients.count == 0 {
            return Err(IssuanceError::EmptyRecipientList);
        }

        self.status = next_status;
        self.issued_at.get_or_insert(now);
        self.failure_reason = None;
        Ok(())
    }

    /// `:cancel`(軟刪,僅 draft):紀錄保留、來源釋放給重建。
    pub fn cancel(&mut self, now: DateTime<Utc>) -> Result<(), IssuanceError> {
        self.status = self.status.cancel()?;
        self.cancelled_at = Some(now);
        Ok(())
    }

    /// worker 認領任務。
    pub fn start_processing(&mut self) -> Result<(), IssuanceError> {
        self.status = self.status.start_processing()?;
        Ok(())
    }

    /// 全批入帳完成。
    pub fn complete(&mut self, now: DateTime<Utc>) -> Result<(), IssuanceError> {
        self.status = self.status.complete()?;
        self.completed_at = Some(now);
        Ok(())
    }

    /// 永久性失敗或重試耗盡;進度由 adapter 保留,聚合只收斂狀態與原因。
    pub fn fail(&mut self, reason: FailureReason) -> Result<(), IssuanceError> {
        self.status = self.status.fail()?;
        self.failure_reason = Some(reason);
        Ok(())
    }

    pub fn issuance_id(&self) -> Uuid {
        self.issuance_id
    }

    pub fn shop_id(&self) -> Uuid {
        self.shop_id
    }

    pub fn author(&self) -> &str {
        &self.author
    }

    pub fn source_id(&self) -> &str {
        &self.source_id
    }

    pub fn amount_per_recipient(&self) -> i64 {
        self.amount_per_recipient
    }

    pub fn window(&self) -> EffectiveWindow {
        self.window
    }

    pub fn status(&self) -> IssuanceStatus {
        self.status
    }

    pub fn upload(&self) -> Option<&UploadSession> {
        self.upload.as_ref()
    }

    pub fn recipients(&self) -> Option<&RecipientList> {
        self.recipients.as_ref()
    }

    pub fn upload_id(&self) -> Option<Uuid> {
        self.upload.as_ref().map(|session| session.upload_id)
    }

    pub fn uploaded_count(&self) -> u64 {
        self.upload
            .as_ref()
            .map_or(0, |session| session.uploaded_count)
    }

    pub fn uploaded_bytes(&self) -> u64 {
        self.upload
            .as_ref()
            .map_or(0, |session| session.uploaded_bytes)
    }

    pub fn recipients_uri(&self) -> Option<&str> {
        self.recipients.as_ref().map(|list| list.uri.as_str())
    }

    pub fn recipient_count(&self) -> Option<u64> {
        self.recipients.as_ref().map(|list| list.count)
    }

    pub fn failure_reason(&self) -> Option<&FailureReason> {
        self.failure_reason.as_ref()
    }

    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    pub fn issued_at(&self) -> Option<DateTime<Utc>> {
        self.issued_at
    }

    pub fn completed_at(&self) -> Option<DateTime<Utc>> {
        self.completed_at
    }

    pub fn cancelled_at(&self) -> Option<DateTime<Utc>> {
        self.cancelled_at
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use point_center_ledger_core::Expiry;

    fn utc(rfc3339: &str) -> DateTime<Utc> {
        rfc3339.parse().expect("valid RFC 3339 timestamp")
    }

    fn draft() -> Issuance {
        Issuance::create(
            NewIssuance {
                issuance_id: Uuid::from_u128(0x1),
                shop_id: Uuid::from_u128(0x51),
                author: "dispatcher".to_string(),
                source_id: "campaign-2026-08".to_string(),
                amount_per_recipient: 500,
                expiration: ExpirationPolicy::OnDate(utc("2026-08-31T00:00:00Z")),
                effective_at: Some(utc("2026-08-01T00:00:00Z")),
            },
            utc("2026-07-16T00:00:00Z"),
        )
        .expect("valid draft issuance")
    }

    /// 已上傳 `count` 行並 finalize 的草稿。
    fn uploaded(count: u64) -> Issuance {
        let mut issuance = draft();
        issuance
            .start_upload_session(Uuid::from_u128(0xA1))
            .unwrap();
        issuance.advance_upload(count, count * 50).unwrap();
        issuance
            .finalize_upload("file:///lists/1/a1".to_string())
            .unwrap();
        issuance
    }

    #[test]
    fn create_starts_in_draft_with_resolved_window() {
        // when
        let issuance = draft();

        // then:draft、無 session、無清單、時間窗已換算
        assert_eq!(issuance.status(), IssuanceStatus::Draft);
        assert_eq!(issuance.upload_id(), None);
        assert_eq!(issuance.recipient_count(), None);
        assert_eq!(issuance.created_at(), utc("2026-07-16T00:00:00Z"));
        assert_eq!(issuance.issued_at(), None);
        assert_eq!(
            issuance.window().effective_at(),
            utc("2026-08-01T00:00:00Z")
        );
        assert_eq!(
            issuance.window().expiry(),
            Expiry::On(utc("2026-08-31T00:00:00Z"))
        );
    }

    #[test]
    fn create_rejects_non_positive_amount() {
        // given
        let mut new_issuance = NewIssuance {
            issuance_id: Uuid::from_u128(0x1),
            shop_id: Uuid::from_u128(0x51),
            author: "manual".to_string(),
            source_id: "cs-ticket-1".to_string(),
            amount_per_recipient: 0,
            expiration: ExpirationPolicy::Never,
            effective_at: None,
        };
        let now = utc("2026-07-16T00:00:00Z");

        // when / then:零與負值一律拒絕
        assert_eq!(
            Issuance::create(new_issuance.clone(), now).unwrap_err(),
            IssuanceError::NonPositiveAmountPerRecipient(0)
        );
        new_issuance.amount_per_recipient = -1;
        assert_eq!(
            Issuance::create(new_issuance, now).unwrap_err(),
            IssuanceError::NonPositiveAmountPerRecipient(-1)
        );
    }

    #[test]
    fn upload_session_accumulates_and_finalizes() {
        // given
        let mut issuance = draft();
        issuance
            .start_upload_session(Uuid::from_u128(0xA1))
            .unwrap();

        // when:兩塊落地(行數累加、位元組前推)後收尾
        issuance.advance_upload(10_000, 262_144).unwrap();
        issuance.advance_upload(2_000, 314_572).unwrap();
        issuance
            .finalize_upload("file:///lists/1/a1".to_string())
            .unwrap();

        // then:快照鎖定 finalize 當下的行數與 URI
        assert_eq!(issuance.uploaded_count(), 12_000);
        assert_eq!(issuance.uploaded_bytes(), 314_572);
        assert_eq!(issuance.recipient_count(), Some(12_000));
        assert_eq!(issuance.recipients_uri(), Some("file:///lists/1/a1"));
    }

    #[test]
    fn new_session_voids_previous_list() {
        // given:已 finalize 的清單
        let mut issuance = uploaded(3);

        // when:開新 session
        issuance
            .start_upload_session(Uuid::from_u128(0xA2))
            .unwrap();

        // then:計數歸零、快照作廢,未 finalize 前不可送出
        assert_eq!(issuance.upload_id(), Some(Uuid::from_u128(0xA2)));
        assert_eq!(issuance.uploaded_count(), 0);
        assert_eq!(issuance.uploaded_bytes(), 0);
        assert_eq!(issuance.recipient_count(), None);
        assert_eq!(
            issuance.issue(utc("2026-07-17T00:00:00Z")).unwrap_err(),
            IssuanceError::RecipientListNotFinalized
        );
    }

    #[test]
    fn advance_requires_open_session_and_monotonic_bytes() {
        // given:未開 session 的草稿
        let mut issuance = draft();

        // when / then:沒有 session 不能記進度
        assert_eq!(
            issuance.advance_upload(1, 50).unwrap_err(),
            IssuanceError::NoOpenUploadSession
        );

        // given:已推進到 262_144 bytes 的 session
        issuance
            .start_upload_session(Uuid::from_u128(0xA1))
            .unwrap();
        issuance.advance_upload(10_000, 262_144).unwrap();

        // when / then:位元組回退即拒絕
        assert_eq!(
            issuance.advance_upload(1, 100).unwrap_err(),
            IssuanceError::UploadBytesRegression {
                current_bytes: 262_144,
                new_bytes: 100
            }
        );
    }

    #[test]
    fn upload_is_rejected_outside_draft_and_failed() {
        // given:已送出(pending)
        let mut issuance = uploaded(2);
        issuance.issue(utc("2026-07-17T00:00:00Z")).unwrap();

        // when / then:開 session、記進度、收尾一律被狀態守衛擋下
        assert!(matches!(
            issuance.start_upload_session(Uuid::from_u128(0xA2)),
            Err(IssuanceError::Status(
                IssuanceStatusError::RecipientsUploadNotAllowed(IssuanceStatus::Pending)
            ))
        ));
        assert!(matches!(
            issuance.advance_upload(1, 999_999),
            Err(IssuanceError::Status(_))
        ));
        assert!(matches!(
            issuance.finalize_upload("file:///x".to_string()),
            Err(IssuanceError::Status(_))
        ));
    }

    #[test]
    fn issue_requires_finalized_non_empty_list() {
        // given:未上傳的草稿
        let mut no_list = draft();

        // when / then:未 finalize 不可送出
        assert_eq!(
            no_list.issue(utc("2026-07-17T00:00:00Z")).unwrap_err(),
            IssuanceError::RecipientListNotFinalized
        );

        // given:finalize 了 0 行
        let mut empty_list = uploaded(0);

        // when / then:空清單不可送出
        assert_eq!(
            empty_list.issue(utc("2026-07-17T00:00:00Z")).unwrap_err(),
            IssuanceError::EmptyRecipientList
        );
    }

    #[test]
    fn issue_records_first_time_only_and_clears_failure() {
        // given:送出後在處理中失敗
        let mut issuance = uploaded(2);
        issuance.issue(utc("2026-07-17T00:00:00Z")).unwrap();
        issuance.start_processing().unwrap();
        issuance
            .fail(FailureReason {
                code: "recipients_file_lost".to_string(),
                message: "part file missing".to_string(),
            })
            .unwrap();
        assert_eq!(issuance.status(), IssuanceStatus::Failed);
        assert!(issuance.failure_reason().is_some());

        // when:重試送出
        issuance.issue(utc("2026-07-18T00:00:00Z")).unwrap();

        // then:回 pending、issued_at 維持首次、失敗原因清除
        assert_eq!(issuance.status(), IssuanceStatus::Pending);
        assert_eq!(issuance.issued_at(), Some(utc("2026-07-17T00:00:00Z")));
        assert_eq!(issuance.failure_reason(), None);
    }

    #[test]
    fn happy_path_reaches_completed() {
        // given
        let mut issuance = uploaded(2);

        // when:送出 → 認領 → 完成
        issuance.issue(utc("2026-07-17T00:00:00Z")).unwrap();
        issuance.start_processing().unwrap();
        issuance.complete(utc("2026-07-17T00:05:00Z")).unwrap();

        // then
        assert_eq!(issuance.status(), IssuanceStatus::Completed);
        assert_eq!(issuance.completed_at(), Some(utc("2026-07-17T00:05:00Z")));
    }

    #[test]
    fn cancel_soft_deletes_draft_only() {
        // given / when:草稿取消
        let mut issuance = draft();
        issuance.cancel(utc("2026-07-16T01:00:00Z")).unwrap();

        // then:cancelled + 時戳,紀錄保留
        assert_eq!(issuance.status(), IssuanceStatus::Cancelled);
        assert_eq!(issuance.cancelled_at(), Some(utc("2026-07-16T01:00:00Z")));

        // given:已送出者
        let mut issued = uploaded(2);
        issued.issue(utc("2026-07-17T00:00:00Z")).unwrap();

        // when / then:不可取消
        assert!(matches!(
            issued.cancel(utc("2026-07-17T01:00:00Z")),
            Err(IssuanceError::Status(
                IssuanceStatusError::CancelNotAllowed(IssuanceStatus::Pending)
            ))
        ));
    }

    #[test]
    fn restore_round_trips_all_fields() {
        // given:一路走到 processing 的聚合
        let mut original = uploaded(12_000);
        original.issue(utc("2026-07-17T00:00:00Z")).unwrap();
        original.start_processing().unwrap();

        // when:以聚合的讀取面重建
        let restored = Issuance::restore(StoredIssuance {
            issuance_id: original.issuance_id(),
            shop_id: original.shop_id(),
            author: original.author().to_string(),
            source_id: original.source_id().to_string(),
            amount_per_recipient: original.amount_per_recipient(),
            window: original.window(),
            status: original.status(),
            upload: original.upload().cloned(),
            recipients: original.recipients().cloned(),
            failure_reason: original.failure_reason().cloned(),
            created_at: original.created_at(),
            issued_at: original.issued_at(),
            completed_at: original.completed_at(),
            cancelled_at: original.cancelled_at(),
        });

        // then:完全等值
        assert_eq!(restored, original);
    }
}
