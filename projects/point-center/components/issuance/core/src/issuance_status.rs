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
