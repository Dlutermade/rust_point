use std::fmt;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::redemption_status::RedemptionStatus;

/// 結算方式:`Deferred` 只預留(待確認);`Immediate` 預留即確認。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Settlement {
    Deferred,
    Immediate,
}

/// 取消原因;[`fmt::Display`] 值即 `points.redemption.cancelled` 事件的 reason 字串。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CancelReason {
    /// 逾時預留由系統自主取消(hold-timeout-job)。
    Timeout,
    /// 呼叫端主動取消(如金流失敗)。
    CallerCancelled,
}

impl fmt::Display for CancelReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Timeout => "timeout",
            Self::CallerCancelled => "caller_cancelled",
        })
    }
}

/// 兌換紀錄(`redemptions` 一列的領域投影);
/// 狀態轉移的守衛見 [`RedemptionStatus`],adapter 於 tx 內套用。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Redemption {
    pub redemption_id: Uuid,
    pub shop_id: Uuid,
    pub customer_id: Uuid,
    pub author: String,
    pub source_id: String,
    pub amount: i64,
    pub status: RedemptionStatus,
    pub reserved_at: DateTime<Utc>,
    /// 預留逾時界限;建立即確認的 [`Settlement::Immediate`] 為 `None`,不逾時。
    pub hold_expires_at: Option<DateTime<Utc>>,
    pub confirmed_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_reason_display_matches_event_values() {
        // then:Display 字串即事件 payload 的 reason 值
        assert_eq!(CancelReason::Timeout.to_string(), "timeout");
        assert_eq!(
            CancelReason::CallerCancelled.to_string(),
            "caller_cancelled"
        );
    }
}
