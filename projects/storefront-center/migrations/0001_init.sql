-- storefront-center — 初始 schema(Model B:每版位多模板,由 targeting 解析當下呈現)。
-- 多租戶;結構化欄位入欄,targeting / chrome / content 存 JSONB。
-- 註:JSONB 不放裸頂層 array(見約定),content 以 {"blocks": [...]} 包裹;
--     API 對外仍以陣列呈現,由 adapter 映射。

CREATE TABLE tenants (
    tenant_id  UUID PRIMARY KEY,
    domain     TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 頁面模板(實體)。每個(租戶, 版位)可有多個;哪個生效由 targeting 於渲染時解析。
CREATE TABLE templates (
    template_id  UUID PRIMARY KEY,
    tenant_id    UUID NOT NULL REFERENCES tenants (tenant_id),
    slot         TEXT NOT NULL CHECK (slot IN ('home', 'header', 'footer')),
    name         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'active', 'paused')),
    -- 頁首/頁尾:站台預設;首頁:常態版(永久兜底)
    is_default   BOOLEAN NOT NULL DEFAULT false,
    targeting    JSONB NOT NULL DEFAULT '{}'::jsonb,             -- {schedule, audience, source, priority}
    chrome       JSONB NOT NULL DEFAULT '{}'::jsonb,             -- {headerId, footerId}
    content      JSONB NOT NULL DEFAULT '{"blocks": []}'::jsonb, -- 區塊實例樹
    version      BIGINT NOT NULL DEFAULT 0,
    note         TEXT,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);
CREATE INDEX idx_templates_tenant_slot ON templates (tenant_id, slot);
-- 每個(租戶, 版位)至多一個站台預設 / 常態版
CREATE UNIQUE INDEX uniq_templates_default
    ON templates (tenant_id, slot) WHERE is_default;

-- 異動紀錄(v1 無登入系統,先不記 who)。不設 FK:模板刪除後仍留痕。
CREATE TABLE template_audit (
    audit_id    UUID PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES tenants (tenant_id),
    template_id UUID NOT NULL,
    action      TEXT NOT NULL,
    detail      TEXT,
    at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_template_audit ON template_audit (template_id, at DESC);

-- 全站設定(品牌色 / 字型 / logo …)
CREATE TABLE theme_settings (
    tenant_id UUID PRIMARY KEY REFERENCES tenants (tenant_id),
    settings  JSONB NOT NULL
);

-- 資產 metadata(本體在 GCS / FS)
CREATE TABLE assets (
    asset_id   UUID PRIMARY KEY,
    tenant_id  UUID NOT NULL REFERENCES tenants (tenant_id),
    uri        TEXT NOT NULL,                      -- gs://… / file://…
    kind       TEXT,
    width      INT,
    height     INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
