use uuid::Uuid;

use crate::effective_window::Expiry;

/// customer_points 一列(兌換所需的投影;呼叫端已完成生效窗過濾與鎖定)。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CustomerPoint {
    pub customer_point_id: Uuid,
    pub remaining_amount: i64,
    pub expiry: Expiry,
}

/// 一筆扣減:從哪筆點數扣多少(對應 redemption_deductions 一列)。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Deduction {
    pub customer_point_id: Uuid,
    pub amount: i64,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum DeductionError {
    #[error("requested amount must be positive, got {0}")]
    NonPositiveAmount(i64),
    #[error("balance {balance} is less than requested {requested_amount}")]
    InsufficientBalance { balance: i64, requested_amount: i64 },
    /// 帳本完整性失敗:負剩餘不該存在(DB CHECK 擋),出現即資料損毀。
    /// 一次回報全部損毀列供取證;對外映成 500,細節只進 log 與告警。
    #[error("corrupted remaining_amount detected on customer points: {points:?}")]
    CorruptedRemainingAmounts { points: Vec<CustomerPoint> },
}

/// 扣減(Domain Service):先扣最快到期的點數(永久點最後),跨筆分攤;
/// 餘額不足整筆拒絕。
///
/// 排序鍵 (expiry, customer_point_id) 與兌換 SQL 的鎖定順序一致
/// (DB 端永久 = 'infinity'::timestamptz,ORDER BY 同樣墊底);
/// 輸入順序不影響結果(內部排序,結果具決定性)。
/// id 為 UUID v7(時間有序),同到期時等同「先發先扣」,且必不平手。
pub fn deduct(
    redeemable_points: &[CustomerPoint],
    requested_amount: i64,
) -> Result<Vec<Deduction>, DeductionError> {
    if requested_amount <= 0 {
        return Err(DeductionError::NonPositiveAmount(requested_amount));
    }

    let corrupted: Vec<CustomerPoint> = redeemable_points
        .iter()
        .filter(|p| p.remaining_amount < 0)
        .cloned()
        .collect();
    if !corrupted.is_empty() {
        return Err(DeductionError::CorruptedRemainingAmounts { points: corrupted });
    }

    let balance: i64 = redeemable_points.iter().map(|p| p.remaining_amount).sum();
    if balance < requested_amount {
        return Err(DeductionError::InsufficientBalance {
            balance,
            requested_amount,
        });
    }

    let mut ordered: Vec<&CustomerPoint> = redeemable_points
        .iter()
        .filter(|p| p.remaining_amount > 0)
        .collect();
    ordered.sort_unstable_by_key(|p| (p.expiry, p.customer_point_id));

    let deductions = ordered
        .into_iter()
        .scan(requested_amount, |remaining_requested_amount, point| {
            if *remaining_requested_amount == 0 {
                return None;
            }

            let amount_to_deduct = (*remaining_requested_amount).min(point.remaining_amount);
            *remaining_requested_amount -= amount_to_deduct;

            Some(Deduction {
                customer_point_id: point.customer_point_id,
                amount: amount_to_deduct,
            })
        })
        .collect();

    Ok(deductions)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn point(id: u128, remaining: i64, expires_at: &str) -> CustomerPoint {
        CustomerPoint {
            customer_point_id: Uuid::from_u128(id),
            remaining_amount: remaining,
            expiry: Expiry::On(expires_at.parse().expect("valid RFC 3339 timestamp")),
        }
    }

    fn permanent_point(id: u128, remaining: i64) -> CustomerPoint {
        CustomerPoint {
            customer_point_id: Uuid::from_u128(id),
            remaining_amount: remaining,
            expiry: Expiry::Never,
        }
    }

    #[test]
    fn deducts_earliest_expiry_first_across_points() {
        // given:A 300 點(8/1 到期)+ B 500 點(9/1 到期),輸入故意亂序
        let a = point(0xA, 300, "2026-08-01T00:00:00Z");
        let b = point(0xB, 500, "2026-09-01T00:00:00Z");

        // when:兌 400
        let got = deduct(&[b.clone(), a.clone()], 400).unwrap();

        // then:先扣最快到期的 A 300,再扣 B 100
        assert_eq!(
            got,
            vec![
                Deduction {
                    customer_point_id: a.customer_point_id,
                    amount: 300
                },
                Deduction {
                    customer_point_id: b.customer_point_id,
                    amount: 100
                },
            ]
        );
    }

    #[test]
    fn permanent_points_are_deducted_last() {
        // given:永久點 500 + 8/1 到期的 300,永久點先進清單
        let forever = permanent_point(0xF, 500);
        let expiring = point(0xA, 300, "2026-08-01T00:00:00Z");
        let holdings = [forever.clone(), expiring.clone()];

        // when:兌 400
        let got = deduct(&holdings, 400).unwrap();

        // then:先扣光會到期的 300,永久點只補差額 100
        assert_eq!(
            got,
            vec![
                Deduction {
                    customer_point_id: expiring.customer_point_id,
                    amount: 300
                },
                Deduction {
                    customer_point_id: forever.customer_point_id,
                    amount: 100
                },
            ]
        );
    }

    #[test]
    fn insufficient_balance_rejects_whole_request() {
        // given:持有 300 點
        let holdings = [point(0xA, 300, "2026-08-01T00:00:00Z")];

        // when:兌 400
        let got = deduct(&holdings, 400);

        // then:整筆拒絕,錯誤附餘額與請求額(對應 API insufficient_balance)
        assert_eq!(
            got,
            Err(DeductionError::InsufficientBalance {
                balance: 300,
                requested_amount: 400
            })
        );
    }

    #[test]
    fn exact_drain_takes_everything() {
        // given:兩筆合計恰為 400
        let holdings = [
            point(0xA, 300, "2026-08-01T00:00:00Z"),
            point(0xB, 100, "2026-09-01T00:00:00Z"),
        ];

        // when:兌 400
        let got = deduct(&holdings, 400).unwrap();

        // then:兩筆扣光,扣減總額 = 請求額
        assert_eq!(got.iter().map(|d| d.amount).sum::<i64>(), 400);
        assert_eq!(got.len(), 2);
    }

    #[test]
    fn single_point_covers_request_without_touching_later_ones() {
        // given:最快到期的一筆 300 點足以覆蓋
        let holdings = [
            point(0xA, 300, "2026-08-01T00:00:00Z"),
            point(0xB, 500, "2026-09-01T00:00:00Z"),
        ];

        // when:兌 200
        let got = deduct(&holdings, 200).unwrap();

        // then:只動第一筆,後面的不碰
        assert_eq!(
            got,
            vec![Deduction {
                customer_point_id: Uuid::from_u128(0xA),
                amount: 200
            }]
        );
    }

    #[test]
    fn same_expiry_breaks_tie_by_id() {
        // given:兩筆同時到期,id 0x2 先進清單
        let holdings = [
            point(0x2, 100, "2026-08-01T00:00:00Z"),
            point(0x1, 100, "2026-08-01T00:00:00Z"),
        ];

        // when:兌 150
        let got = deduct(&holdings, 150).unwrap();

        // then:以 customer_point_id 為次鍵——0x1 先扣光(與 SQL 鎖序一致)
        assert_eq!(got[0].customer_point_id, Uuid::from_u128(0x1));
        assert_eq!(got[0].amount, 100);
        assert_eq!(got[1].amount, 50);
    }

    #[test]
    fn drained_points_are_ignored() {
        // given:第一筆已扣光(remaining = 0)
        let holdings = [
            point(0xA, 0, "2026-08-01T00:00:00Z"),
            point(0xB, 500, "2026-09-01T00:00:00Z"),
        ];

        // when:兌 100
        let got = deduct(&holdings, 100).unwrap();

        // then:直接從還有殘值的那筆扣
        assert_eq!(got[0].customer_point_id, Uuid::from_u128(0xB));
    }

    #[test]
    fn empty_holdings_report_zero_balance() {
        // given:沒有任何點數

        // when:兌 100
        let got = deduct(&[], 100);

        // then:以餘額 0 拒絕
        assert_eq!(
            got,
            Err(DeductionError::InsufficientBalance {
                balance: 0,
                requested_amount: 100
            })
        );
    }

    #[test]
    fn corrupted_negative_remaining_is_reported_loudly() {
        // given:兩筆負剩餘(DB CHECK 之下不該存在的損毀資料),且其他點數足以支付
        let bad_1 = point(0xBAD1, -50, "2026-08-01T00:00:00Z");
        let bad_2 = permanent_point(0xBAD2, -7);
        let holdings = [
            bad_1.clone(),
            point(0xA, 500, "2026-09-01T00:00:00Z"),
            bad_2.clone(),
        ];

        // when:兌 100(就算不碰損毀那些筆也扣得起)
        let got = deduct(&holdings, 100);

        // then:仍然報損毀,且一次回報全部損毀列——完整性失敗優先於一切
        assert_eq!(
            got,
            Err(DeductionError::CorruptedRemainingAmounts {
                points: vec![bad_1, bad_2]
            })
        );
    }

    #[test]
    fn non_positive_request_is_rejected() {
        // when / then:0 與負數請求一律拒絕
        assert_eq!(deduct(&[], 0), Err(DeductionError::NonPositiveAmount(0)));
        assert_eq!(deduct(&[], -5), Err(DeductionError::NonPositiveAmount(-5)));
    }
}
