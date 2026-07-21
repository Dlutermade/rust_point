-- ledger component — 兌換(有狀態聚合:預留 → 確認 / 取消,TCC)。

CREATE TABLE redemptions (
    redemption_id     UUID PRIMARY KEY,
    shop_id           UUID NOT NULL,
    customer_id       UUID NOT NULL,
    author            TEXT NOT NULL,
    source_id         TEXT NOT NULL,
    amount            BIGINT NOT NULL CHECK (amount > 0),
    status            TEXT NOT NULL DEFAULT 'reserved'
                      CHECK (status IN ('reserved', 'confirmed', 'cancelled')),
    reserved_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    hold_expires_at   TIMESTAMPTZ,               -- 預留逾時界限;即時兌換(建立即確認)為 NULL
    confirmed_at      TIMESTAMPTZ,               -- confirmed 必填
    cancelled_at      TIMESTAMPTZ,               -- cancelled 必填(軟刪語意)
    CHECK ((confirmed_at IS NOT NULL) = (status = 'confirmed')),
    CHECK ((cancelled_at IS NOT NULL) = (status = 'cancelled'))
);
-- 同 shop 同客戶同來源同時最多一筆「活的」;取消後同訂單可重來。
CREATE UNIQUE INDEX uq_redemptions_active_source
    ON redemptions (shop_id, customer_id, author, source_id)
    WHERE status <> 'cancelled';
-- 逾時預留掃描。
CREATE INDEX idx_redemptions_hold_expiring
    ON redemptions (hold_expires_at) WHERE status = 'reserved';

-- 兌換扣減明細(redemption 的子表;一列 = 從哪筆點數扣多少,與預留同 tx 寫入)。
CREATE TABLE redemption_deductions (
    redemption_id     UUID NOT NULL REFERENCES redemptions (redemption_id),
    customer_point_id UUID NOT NULL REFERENCES customer_points (customer_point_id),
    amount            BIGINT NOT NULL CHECK (amount > 0),
    PRIMARY KEY (redemption_id, customer_point_id)
);
-- 批次守恆 / 反查用。
CREATE INDEX idx_redemption_deductions_point ON redemption_deductions (customer_point_id);
