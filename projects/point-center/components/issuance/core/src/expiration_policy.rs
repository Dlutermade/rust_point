use chrono::{DateTime, Utc};
use point_center_ledger_core::{EffectiveWindow, EffectiveWindowError, Expiry};

/// 到期方式,二選一;對應 API 欄位 expireOnDate / expireNever。
/// 相對天數(「生效後 N 天」)由呼叫端換算成絕對時點,domain 只認絕對時點。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExpirationPolicy {
    /// 指定時點失效;須晚於現在。
    OnDate(DateTime<Utc>),
    /// 永久:生效後恆可用,不進到期任務。
    Never,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ExpirationPolicyError {
    #[error("expiration date {0} must be later than now")]
    ExpirationDateNotInFuture(DateTime<Utc>),
    #[error(transparent)]
    EffectiveWindow(#[from] EffectiveWindowError),
}

impl ExpirationPolicy {
    /// 換算為絕對生效窗;`effective_at` 省略 = 發點當下(now)。
    /// `now` 由呼叫端注入,domain 不讀時鐘。
    pub fn resolve(
        self,
        effective_at: Option<DateTime<Utc>>,
        now: DateTime<Utc>,
    ) -> Result<EffectiveWindow, ExpirationPolicyError> {
        let effective_at = effective_at.unwrap_or(now);
        let expiry = match self {
            Self::OnDate(expires_at) if expires_at <= now => {
                Err(ExpirationPolicyError::ExpirationDateNotInFuture(expires_at))
            }
            Self::OnDate(expires_at) => Ok(Expiry::On(expires_at)),
            Self::Never => Ok(Expiry::Never),
        }?;
        Ok(EffectiveWindow::new(effective_at, expiry)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utc(rfc3339: &str) -> DateTime<Utc> {
        rfc3339.parse().expect("valid RFC 3339 timestamp")
    }

    #[test]
    fn on_date_gives_batch_wide_fixed_expiry() {
        // given:指定 12/31 23:59 全批失效
        let policy = ExpirationPolicy::OnDate(utc("2026-12-31T23:59:00Z"));

        // when
        let window = policy.resolve(None, utc("2026-07-16T00:00:00Z")).unwrap();

        // then:到期時間即指定時點
        assert_eq!(window.expiry(), Expiry::On(utc("2026-12-31T23:59:00Z")));
    }

    #[test]
    fn omitted_effective_defaults_to_now() {
        // given:7/16 發點、未指定生效時間
        let policy = ExpirationPolicy::OnDate(utc("2026-12-31T23:59:00Z"));

        // when
        let window = policy.resolve(None, utc("2026-07-16T00:00:00Z")).unwrap();

        // then:發點當下即生效
        assert_eq!(window.effective_at(), utc("2026-07-16T00:00:00Z"));
    }

    #[test]
    fn never_resolves_to_permanent_window() {
        // given:永久點
        let policy = ExpirationPolicy::Never;

        // when
        let window = policy
            .resolve(
                Some(utc("2026-08-01T00:00:00Z")),
                utc("2026-07-16T00:00:00Z"),
            )
            .unwrap();

        // then:生效照常、無到期端
        assert_eq!(window.effective_at(), utc("2026-08-01T00:00:00Z"));
        assert_eq!(window.expiry(), Expiry::Never);
    }

    #[test]
    fn on_date_must_be_in_the_future() {
        // given:現在是 7/16
        let now = utc("2026-07-16T00:00:00Z");

        // when:指定過去(7/1)或此刻為到期時點
        let past = ExpirationPolicy::OnDate(utc("2026-07-01T00:00:00Z")).resolve(None, now);
        let exactly_now = ExpirationPolicy::OnDate(now).resolve(None, now);

        // then:一律拒絕
        assert_eq!(
            past,
            Err(ExpirationPolicyError::ExpirationDateNotInFuture(utc(
                "2026-07-01T00:00:00Z"
            )))
        );
        assert!(exactly_now.is_err());
    }

    #[test]
    fn effective_after_expiry_is_rejected() {
        // given:到期 8/1,生效卻指定 9/1
        let policy = ExpirationPolicy::OnDate(utc("2026-08-01T00:00:00Z"));

        // when
        let got = policy.resolve(
            Some(utc("2026-09-01T00:00:00Z")),
            utc("2026-07-16T00:00:00Z"),
        );

        // then:生效窗不變量拒絕(EffectiveWindowError 透傳)
        assert!(matches!(
            got,
            Err(ExpirationPolicyError::EffectiveWindow(_))
        ));
    }
}
