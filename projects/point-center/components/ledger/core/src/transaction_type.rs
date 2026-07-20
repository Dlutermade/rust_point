use std::fmt;

/// 交易類型;Display 值即 DB 的 transaction_type 與 API 的 type 字串。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransactionType {
    Grant,
    Redeem,
    Release,
    Expire,
    Adjust,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum TransactionTypeError {
    #[error("amount_change {amount_change} violates the sign rule of {transaction_type}")]
    InvalidAmountChange {
        transaction_type: TransactionType,
        amount_change: i64,
    },
}

impl TransactionType {
    /// 不變量:發點/釋放回補為正、兌換/到期為負、調整非零。
    pub fn validate_amount_change(self, amount_change: i64) -> Result<(), TransactionTypeError> {
        let valid = match self {
            Self::Grant | Self::Release => amount_change > 0,
            Self::Redeem | Self::Expire => amount_change < 0,
            Self::Adjust => amount_change != 0,
        };

        valid
            .then_some(())
            .ok_or(TransactionTypeError::InvalidAmountChange {
                transaction_type: self,
                amount_change,
            })
    }
}

impl fmt::Display for TransactionType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Grant => "grant",
            Self::Redeem => "redeem",
            Self::Release => "release",
            Self::Expire => "expire",
            Self::Adjust => "adjust",
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grant_requires_positive_change() {
        // then:發點必為正數
        assert!(TransactionType::Grant.validate_amount_change(500).is_ok());
        assert!(TransactionType::Grant.validate_amount_change(0).is_err());
        assert!(TransactionType::Grant.validate_amount_change(-1).is_err());
    }

    #[test]
    fn release_requires_positive_change() {
        // then:取消釋放回補必為正數(與 redeem 成對、方向相反)
        assert!(TransactionType::Release.validate_amount_change(400).is_ok());
        assert!(TransactionType::Release.validate_amount_change(0).is_err());
        assert!(
            TransactionType::Release
                .validate_amount_change(-400)
                .is_err()
        );
    }

    #[test]
    fn redeem_and_expire_require_negative_change() {
        // then:兌換與到期必為負數
        assert!(TransactionType::Redeem.validate_amount_change(-400).is_ok());
        assert!(TransactionType::Redeem.validate_amount_change(400).is_err());
        assert!(TransactionType::Expire.validate_amount_change(-120).is_ok());
        assert!(TransactionType::Expire.validate_amount_change(120).is_err());
    }

    #[test]
    fn adjust_requires_nonzero_change() {
        // then:調整可正可負,不可為零
        assert!(TransactionType::Adjust.validate_amount_change(10).is_ok());
        assert!(TransactionType::Adjust.validate_amount_change(-10).is_ok());
        assert!(TransactionType::Adjust.validate_amount_change(0).is_err());
    }

    #[test]
    fn display_matches_db_values() {
        // then:Display 字串即 DB 欄位值
        assert_eq!(TransactionType::Grant.to_string(), "grant");
        assert_eq!(TransactionType::Redeem.to_string(), "redeem");
        assert_eq!(TransactionType::Release.to_string(), "release");
        assert_eq!(TransactionType::Expire.to_string(), "expire");
        assert_eq!(TransactionType::Adjust.to_string(), "adjust");
    }
}
