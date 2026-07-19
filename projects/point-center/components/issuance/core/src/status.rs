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
pub enum StatusError {
    #[error("recipients can only be uploaded in draft or failed, current: {0}")]
    UploadNotAllowed(IssuanceStatus),
    #[error("issue is not allowed from {0}")]
    IssueNotAllowed(IssuanceStatus),
    #[error("cancel is not allowed from {0}")]
    CancelNotAllowed(IssuanceStatus),
}

impl IssuanceStatus {
    /// Recipient list upload/replacement is allowed only while editable.
    pub fn can_upload_recipients(self) -> bool {
        matches!(self, Self::Draft | Self::Failed)
    }

    /// `:issue` transition — submit (from draft) or retry (from failed).
    pub fn issue(self) -> Result<IssuanceStatus, StatusError> {
        match self {
            Self::Draft | Self::Failed => Ok(Self::Pending),
            other => Err(StatusError::IssueNotAllowed(other)),
        }
    }

    /// `:cancel` transition — soft delete, draft only.
    pub fn cancel(self) -> Result<IssuanceStatus, StatusError> {
        match self {
            Self::Draft => Ok(Self::Cancelled),
            other => Err(StatusError::CancelNotAllowed(other)),
        }
    }
}

impl fmt::Display for IssuanceStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Draft => "draft",
            Self::Pending => "pending",
            Self::Processing => "processing",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        };
        f.write_str(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upload_allowed_only_in_draft_and_failed() {
        assert!(IssuanceStatus::Draft.can_upload_recipients());
        assert!(IssuanceStatus::Failed.can_upload_recipients());
        assert!(!IssuanceStatus::Pending.can_upload_recipients());
        assert!(!IssuanceStatus::Processing.can_upload_recipients());
        assert!(!IssuanceStatus::Completed.can_upload_recipients());
        assert!(!IssuanceStatus::Cancelled.can_upload_recipients());
    }

    #[test]
    fn issue_from_draft_and_failed_only() {
        assert_eq!(IssuanceStatus::Draft.issue(), Ok(IssuanceStatus::Pending));
        assert_eq!(IssuanceStatus::Failed.issue(), Ok(IssuanceStatus::Pending));
        assert_eq!(
            IssuanceStatus::Completed.issue(),
            Err(StatusError::IssueNotAllowed(IssuanceStatus::Completed))
        );
        assert_eq!(
            IssuanceStatus::Cancelled.issue(),
            Err(StatusError::IssueNotAllowed(IssuanceStatus::Cancelled))
        );
    }

    #[test]
    fn cancel_from_draft_only() {
        assert_eq!(IssuanceStatus::Draft.cancel(), Ok(IssuanceStatus::Cancelled));
        for status in [
            IssuanceStatus::Pending,
            IssuanceStatus::Processing,
            IssuanceStatus::Completed,
            IssuanceStatus::Failed,
            IssuanceStatus::Cancelled,
        ] {
            assert_eq!(status.cancel(), Err(StatusError::CancelNotAllowed(status)));
        }
    }
}
