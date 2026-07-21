-- ledger component — 客戶點數(一列一批)與交易留痕。

CREATE TABLE customer_points (
    customer_point_id UUID PRIMARY KEY,
    shop_id           UUID NOT NULL,
    customer_id       UUID NOT NULL,
    original_amount   BIGINT NOT NULL CHECK (original_amount > 0),
    remaining_amount  BIGINT NOT NULL CHECK (remaining_amount >= 0),
    effective_at      TIMESTAMPTZ NOT NULL,
    expires_at        TIMESTAMPTZ NOT NULL,       -- 永久 = 'infinity'(PG 原生值,查詢/排序零特判)
    issuance_id       UUID NOT NULL REFERENCES point_issuances (issuance_id),
    author            TEXT NOT NULL,
    source_id         TEXT NOT NULL,
    granted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shop_id, author, source_id, customer_id) -- 防重複:同 shop 同來源同客戶一生一次
);
CREATE INDEX idx_customer_points_active ON customer_points (shop_id, customer_id, expires_at);
-- 到期掃描專用。
CREATE INDEX idx_customer_points_expirable
    ON customer_points (expires_at) WHERE remaining_amount > 0;

CREATE TABLE point_transactions (
    transaction_id     UUID PRIMARY KEY,
    shop_id            UUID NOT NULL,
    customer_id        UUID NOT NULL,
    transaction_type   TEXT NOT NULL CHECK (transaction_type IN ('grant', 'redeem', 'release', 'expire', 'adjust')),
    amount_change      BIGINT NOT NULL,              -- 發點/取消釋放正、兌換/到期負
    author             TEXT NOT NULL,                -- 到期 = 'system'
    source_id          TEXT NOT NULL,                -- 到期 = 過期批次 ID;兌換 = redemption 的來源
    occurred_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shop_id, customer_id, author, source_id, transaction_type) -- 來源即冪等:每來源每類型至多一筆
);
CREATE INDEX idx_point_transactions_customer ON point_transactions (shop_id, customer_id, occurred_at DESC);
