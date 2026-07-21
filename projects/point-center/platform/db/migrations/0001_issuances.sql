-- issuance component — 發點紀錄(兼入帳進度追蹤)。
-- 一 DB 一 project;本目錄是 point-center 整個 context 的 schema,
-- 表的「擁有者」是邏輯上的 component,物理上共用這個資料庫。

CREATE TABLE point_issuances (
    issuance_id           UUID PRIMARY KEY,
    shop_id               UUID NOT NULL,             -- 租戶,外部核發
    author                TEXT NOT NULL,
    source_id             TEXT NOT NULL,
    amount_per_recipient  BIGINT NOT NULL CHECK (amount_per_recipient > 0),
    effective_at          TIMESTAMPTZ NOT NULL,
    expires_at            TIMESTAMPTZ NOT NULL,       -- 永久 = 'infinity'
    recipients_uri        TEXT,                       -- 清單快照 URI(file:// | gs://,不可變)
    recipient_count       INT,
    upload_id             UUID,                       -- 現行上傳 session;開新即換
    uploaded_count        INT NOT NULL DEFAULT 0,     -- 已持久化完整行數
    uploaded_bytes        BIGINT NOT NULL DEFAULT 0,  -- 續傳 Range 的真相來源
    processed_count       INT NOT NULL DEFAULT 0,
    granted_count         INT NOT NULL DEFAULT 0,     -- 防重複略過者不計入
    status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'pending', 'processing', 'completed', 'failed', 'cancelled')),
    failure_reason        JSONB,                      -- failed 時必填:{code, message} 與 API 錯誤同形
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    issued_at             TIMESTAMPTZ,                -- 首次 :issue 時間;draft/cancelled 為 NULL,重試不改寫
    completed_at          TIMESTAMPTZ,
    cancelled_at          TIMESTAMPTZ,                -- cancelled 時必填(軟刪時間)
    CHECK (effective_at < expires_at)
);

-- 同 shop 同來源同時最多一筆「活的」;取消(軟刪)後可重建修正版。
CREATE UNIQUE INDEX uq_point_issuances_active_source
    ON point_issuances (shop_id, author, source_id)
    WHERE status <> 'cancelled';
