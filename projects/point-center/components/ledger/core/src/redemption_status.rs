use std::fmt;

/// Redemption lifecycle (TCC participant). `Confirmed` and `Cancelled`
/// are both irreversible terminal states — refunding a confirmed
/// redemption is a different capability (v2), not a transition here.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RedemptionStatus {
    Reserved,
    Confirmed,
    Cancelled,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum RedemptionStatusError {
    #[error("confirm is not allowed from {0}")]
    ConfirmNotAllowed(RedemptionStatus),
    #[error("cancel is not allowed from {0}")]
    CancelNotAllowed(RedemptionStatus),
}

impl RedemptionStatus {
    /// `:confirm` transition — 定案,點在預留時已扣,僅轉狀態。
    ///
    /// 守衛為嚴格式:重複 confirm 的冪等回應與「撞已取消 → 409」的
    /// 區分由 interactor 依錯誤內的當前狀態決定。
    pub fn confirm(self) -> Result<RedemptionStatus, RedemptionStatusError> {
        match self {
            Self::Reserved => Ok(Self::Confirmed),
            Self::Confirmed | Self::Cancelled => {
                Err(RedemptionStatusError::ConfirmNotAllowed(self))
            }
        }
    }

    /// `:cancel` transition — 主動取消與逾時取消同一守衛;
    /// 通過後由 interactor 以 release 交易補回原批。
    pub fn cancel(self) -> Result<RedemptionStatus, RedemptionStatusError> {
        match self {
            Self::Reserved => Ok(Self::Cancelled),
            Self::Confirmed | Self::Cancelled => Err(RedemptionStatusError::CancelNotAllowed(self)),
        }
    }
}

impl fmt::Display for RedemptionStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Reserved => "reserved",
            Self::Confirmed => "confirmed",
            Self::Cancelled => "cancelled",
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn confirm_from_reserved_only() {
        // when / then:預留可定案
        assert_eq!(
            RedemptionStatus::Reserved.confirm(),
            Ok(RedemptionStatus::Confirmed)
        );

        // then:終態一律拒絕,錯誤附當前狀態(interactor 據此區分冪等回應與 409)
        assert_eq!(
            RedemptionStatus::Confirmed.confirm(),
            Err(RedemptionStatusError::ConfirmNotAllowed(
                RedemptionStatus::Confirmed
            ))
        );
        assert_eq!(
            RedemptionStatus::Cancelled.confirm(),
            Err(RedemptionStatusError::ConfirmNotAllowed(
                RedemptionStatus::Cancelled
            ))
        );
    }

    #[test]
    fn cancel_from_reserved_only() {
        // when / then:預留可取消(主動或逾時)
        assert_eq!(
            RedemptionStatus::Reserved.cancel(),
            Ok(RedemptionStatus::Cancelled)
        );

        // then:定案後不可取消(退點屬 v2 退款,非取消);已取消亦拒絕
        assert_eq!(
            RedemptionStatus::Confirmed.cancel(),
            Err(RedemptionStatusError::CancelNotAllowed(
                RedemptionStatus::Confirmed
            ))
        );
        assert_eq!(
            RedemptionStatus::Cancelled.cancel(),
            Err(RedemptionStatusError::CancelNotAllowed(
                RedemptionStatus::Cancelled
            ))
        );
    }

    #[test]
    fn display_matches_db_values() {
        // then:Display 字串即 DB 欄位值
        assert_eq!(RedemptionStatus::Reserved.to_string(), "reserved");
        assert_eq!(RedemptionStatus::Confirmed.to_string(), "confirmed");
        assert_eq!(RedemptionStatus::Cancelled.to_string(), "cancelled");
    }
}
