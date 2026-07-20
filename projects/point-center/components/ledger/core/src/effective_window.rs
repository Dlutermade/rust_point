use chrono::{DateTime, Utc};

/// 到期:指定時刻或永久。
/// [`Ord`] 為 `On(較早) < On(較晚) < Never`——即扣減順序「快到期先用、永久最後」。
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Expiry {
    On(DateTime<Utc>),
    Never,
}

/// 生效窗 `[effective_at, expiry)`;永久點無右端(生效後恆可用)。
/// Fields are private so an invalid window (effective >= expiry) cannot exist.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EffectiveWindow {
    effective_at: DateTime<Utc>,
    expiry: Expiry,
}

/// 批次在某時刻相對於生效窗的狀態:未生效 / 生效窗內 / 已到期。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EffectiveWindowPhase {
    /// 未生效:客戶可見「即將入袋」,但不計餘額、不可兌換。
    Pending,
    /// 生效窗內:計餘額、可兌換;永久點生效後恆為此態。
    Active,
    /// 已到期:餘額即時排除;留痕與事件由到期任務補。
    Expired,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum EffectiveWindowError {
    #[error("effective_at {effective_at} must be earlier than expires_at {expires_at}")]
    EffectiveNotBeforeExpiry {
        effective_at: DateTime<Utc>,
        expires_at: DateTime<Utc>,
    },
}

impl EffectiveWindow {
    pub fn new(effective_at: DateTime<Utc>, expiry: Expiry) -> Result<Self, EffectiveWindowError> {
        match expiry {
            Expiry::On(expires_at) if effective_at >= expires_at => {
                Err(EffectiveWindowError::EffectiveNotBeforeExpiry {
                    effective_at,
                    expires_at,
                })
            }
            Expiry::On(_) | Expiry::Never => Ok(Self {
                effective_at,
                expiry,
            }),
        }
    }

    pub fn effective_at(&self) -> DateTime<Utc> {
        self.effective_at
    }

    pub fn expiry(&self) -> Expiry {
        self.expiry
    }

    /// 查詢級瞬間生效的口徑:兩端都以「當下時刻」判定,不依賴排程。
    pub fn phase_at(&self, at: DateTime<Utc>) -> EffectiveWindowPhase {
        match self.expiry {
            _ if at < self.effective_at => EffectiveWindowPhase::Pending,
            Expiry::Never => EffectiveWindowPhase::Active,
            Expiry::On(expires_at) if at < expires_at => EffectiveWindowPhase::Active,
            Expiry::On(_) => EffectiveWindowPhase::Expired,
        }
    }

    /// 窗內(可計餘額、可兌換)。
    pub fn contains(&self, at: DateTime<Utc>) -> bool {
        self.phase_at(at) == EffectiveWindowPhase::Active
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utc(rfc3339: &str) -> DateTime<Utc> {
        rfc3339.parse().expect("valid RFC 3339 timestamp")
    }

    #[test]
    fn rejects_effective_not_before_expiry() {
        // given:兩個時刻
        let aug_1 = utc("2026-08-01T00:00:00Z");
        let aug_2 = utc("2026-08-02T00:00:00Z");

        // when / then:有到期時,生效必須嚴格早於到期
        assert!(EffectiveWindow::new(aug_1, Expiry::On(aug_1)).is_err()); // 相等
        assert!(EffectiveWindow::new(aug_2, Expiry::On(aug_1)).is_err()); // 顛倒
        assert!(EffectiveWindow::new(aug_1, Expiry::On(aug_2)).is_ok());

        // then:永久窗恆合法
        assert!(EffectiveWindow::new(aug_1, Expiry::Never).is_ok());
    }

    #[test]
    fn half_open_boundaries() {
        // given:8/1 生效、8/31 到期的窗
        let window = EffectiveWindow::new(
            utc("2026-08-01T00:00:00Z"),
            Expiry::On(utc("2026-08-31T00:00:00Z")),
        )
        .unwrap();

        // then:生效瞬間即可用、到期瞬間即排除(半開區間)
        assert!(!window.contains(utc("2026-07-31T23:59:59Z"))); // 生效前一秒
        assert!(window.contains(utc("2026-08-01T00:00:00Z")));
        assert!(window.contains(utc("2026-08-15T12:00:00Z")));
        assert!(!window.contains(utc("2026-08-31T00:00:00Z")));
    }

    #[test]
    fn phase_transitions_at_boundaries() {
        // given:8/1 生效、8/31 到期的窗
        let window = EffectiveWindow::new(
            utc("2026-08-01T00:00:00Z"),
            Expiry::On(utc("2026-08-31T00:00:00Z")),
        )
        .unwrap();

        // then:三態在邊界上的歸屬與 contains 同口徑
        assert_eq!(
            window.phase_at(utc("2026-07-31T23:59:59Z")),
            EffectiveWindowPhase::Pending
        );
        assert_eq!(
            window.phase_at(utc("2026-08-01T00:00:00Z")),
            EffectiveWindowPhase::Active
        );
        assert_eq!(
            window.phase_at(utc("2026-08-31T00:00:00Z")),
            EffectiveWindowPhase::Expired
        );
    }

    #[test]
    fn permanent_window_never_expires() {
        // given:8/1 生效的永久窗
        let window = EffectiveWindow::new(utc("2026-08-01T00:00:00Z"), Expiry::Never).unwrap();

        // then:生效前仍是未生效;生效後恆為 Active,遠未來也不過期
        assert_eq!(
            window.phase_at(utc("2026-07-31T23:59:59Z")),
            EffectiveWindowPhase::Pending
        );
        assert_eq!(
            window.phase_at(utc("2026-08-01T00:00:00Z")),
            EffectiveWindowPhase::Active
        );
        assert_eq!(
            window.phase_at(utc("2126-01-01T00:00:00Z")), // 一百年後
            EffectiveWindowPhase::Active
        );
    }

    #[test]
    fn expiry_orders_earliest_first_and_never_last() {
        // then:Ord 即扣減順序——快到期在前,永久墊底
        let earlier = Expiry::On(utc("2026-08-01T00:00:00Z"));
        let later = Expiry::On(utc("2026-09-01T00:00:00Z"));
        assert!(earlier < later);
        assert!(later < Expiry::Never);
    }
}
