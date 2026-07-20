use std::fmt;

/// Issuance lifecycle. `Completed` and `Cancelled` are irreversible
/// terminal states; `Failed` is re-entrant (list repair + retry are legal).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IssuanceStatus {
    Draft,
    Pending,
    Processing,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum IssuanceStatusError {
    #[error("recipients can only be uploaded in draft or failed, current: {0}")]
    RecipientsUploadNotAllowed(IssuanceStatus),
    #[error("issue is not allowed from {0}")]
    IssueNotAllowed(IssuanceStatus),
    #[error("cancel is not allowed from {0}")]
    CancelNotAllowed(IssuanceStatus),
    #[error("start processing is not allowed from {0}")]
    StartProcessingNotAllowed(IssuanceStatus),
    #[error("complete is not allowed from {0}")]
    CompleteNotAllowed(IssuanceStatus),
    #[error("fail is not allowed from {0}")]
    FailNotAllowed(IssuanceStatus),
}

impl IssuanceStatus {
    /// 名單上傳/替換僅在可編輯狀態允許:draft 建檔中、failed 修復清單。
    pub fn validate_recipients_upload(self) -> Result<(), IssuanceStatusError> {
        match self {
            Self::Draft | Self::Failed => Ok(()),
            Self::Pending | Self::Processing | Self::Completed | Self::Cancelled => {
                Err(IssuanceStatusError::RecipientsUploadNotAllowed(self))
            }
        }
    }

    /// `:issue` transition — submit (from draft) or retry (from failed).
    pub fn issue(self) -> Result<IssuanceStatus, IssuanceStatusError> {
        match self {
            Self::Draft | Self::Failed => Ok(Self::Pending),
            Self::Pending | Self::Processing | Self::Completed | Self::Cancelled => {
                Err(IssuanceStatusError::IssueNotAllowed(self))
            }
        }
    }

    /// `:cancel` transition — soft delete, draft only.
    pub fn cancel(self) -> Result<IssuanceStatus, IssuanceStatusError> {
        match self {
            Self::Draft => Ok(Self::Cancelled),
            Self::Pending | Self::Processing | Self::Completed | Self::Failed | Self::Cancelled => {
                Err(IssuanceStatusError::CancelNotAllowed(self))
            }
        }
    }

    /// worker 認領任務:pending → processing。
    pub fn start_processing(self) -> Result<IssuanceStatus, IssuanceStatusError> {
        match self {
            Self::Pending => Ok(Self::Processing),
            Self::Draft | Self::Processing | Self::Completed | Self::Failed | Self::Cancelled => {
                Err(IssuanceStatusError::StartProcessingNotAllowed(self))
            }
        }
    }

    /// 全批入帳完成:processing → completed(不可逆終態)。
    pub fn complete(self) -> Result<IssuanceStatus, IssuanceStatusError> {
        match self {
            Self::Processing => Ok(Self::Completed),
            Self::Draft | Self::Pending | Self::Completed | Self::Failed | Self::Cancelled => {
                Err(IssuanceStatusError::CompleteNotAllowed(self))
            }
        }
    }

    /// 永久性失敗或重試耗盡:processing → failed(可重入終態)。
    pub fn fail(self) -> Result<IssuanceStatus, IssuanceStatusError> {
        match self {
            Self::Processing => Ok(Self::Failed),
            Self::Draft | Self::Pending | Self::Completed | Self::Failed | Self::Cancelled => {
                Err(IssuanceStatusError::FailNotAllowed(self))
            }
        }
    }
}

impl fmt::Display for IssuanceStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Draft => "draft",
            Self::Pending => "pending",
            Self::Processing => "processing",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upload_allowed_only_in_draft_and_failed() {
        // then:僅 draft 與 failed(修復清單)可收清單
        assert!(IssuanceStatus::Draft.validate_recipients_upload().is_ok());
        assert!(IssuanceStatus::Failed.validate_recipients_upload().is_ok());

        // then:其餘狀態一律拒絕,錯誤附當前狀態
        for status in [
            IssuanceStatus::Pending,
            IssuanceStatus::Processing,
            IssuanceStatus::Completed,
            IssuanceStatus::Cancelled,
        ] {
            assert_eq!(
                status.validate_recipients_upload(),
                Err(IssuanceStatusError::RecipientsUploadNotAllowed(status))
            );
        }
    }

    #[test]
    fn issue_from_draft_and_failed_only() {
        // when / then:draft 送出、failed 重試 → pending
        assert_eq!(IssuanceStatus::Draft.issue(), Ok(IssuanceStatus::Pending));
        assert_eq!(IssuanceStatus::Failed.issue(), Ok(IssuanceStatus::Pending));

        // then:終態拒絕送出
        assert_eq!(
            IssuanceStatus::Completed.issue(),
            Err(IssuanceStatusError::IssueNotAllowed(
                IssuanceStatus::Completed
            ))
        );
        assert_eq!(
            IssuanceStatus::Cancelled.issue(),
            Err(IssuanceStatusError::IssueNotAllowed(
                IssuanceStatus::Cancelled
            ))
        );
    }

    #[test]
    fn worker_transitions_follow_claim_then_terminal() {
        // when / then:認領僅限 pending
        assert_eq!(
            IssuanceStatus::Pending.start_processing(),
            Ok(IssuanceStatus::Processing)
        );
        assert_eq!(
            IssuanceStatus::Draft.start_processing(),
            Err(IssuanceStatusError::StartProcessingNotAllowed(
                IssuanceStatus::Draft
            ))
        );

        // when / then:完成與失敗僅限 processing
        assert_eq!(
            IssuanceStatus::Processing.complete(),
            Ok(IssuanceStatus::Completed)
        );
        assert_eq!(
            IssuanceStatus::Processing.fail(),
            Ok(IssuanceStatus::Failed)
        );
        assert_eq!(
            IssuanceStatus::Pending.complete(),
            Err(IssuanceStatusError::CompleteNotAllowed(
                IssuanceStatus::Pending
            ))
        );
        assert_eq!(
            IssuanceStatus::Completed.fail(),
            Err(IssuanceStatusError::FailNotAllowed(
                IssuanceStatus::Completed
            ))
        );
    }

    #[test]
    fn cancel_from_draft_only() {
        // when / then:draft 可取消(軟刪)
        assert_eq!(
            IssuanceStatus::Draft.cancel(),
            Ok(IssuanceStatus::Cancelled)
        );

        // then:其餘狀態一律拒絕
        for status in [
            IssuanceStatus::Pending,
            IssuanceStatus::Processing,
            IssuanceStatus::Completed,
            IssuanceStatus::Failed,
            IssuanceStatus::Cancelled,
        ] {
            assert_eq!(
                status.cancel(),
                Err(IssuanceStatusError::CancelNotAllowed(status))
            );
        }
    }
}
