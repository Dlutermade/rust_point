-- storefront-center — 初始 schema。
--
-- 三個實體各一張表:頁首模板 / 頁尾模板 / 首頁模板。三者沒有共同上位分類 ——
-- 首頁模板有 SEO + 完整生效條件 + 外框覆寫;頁首 / 頁尾只有「哪份是站台預設」。
-- 硬塞一張表的代價是:一半欄位恆為 NULL、is_default 一欄兩義、CHECK 約束隨
-- 頁面種類增加而膨脹。分表後每張表的欄位、約束、audit 動作集都能各自演進。
--
-- 建表順序:首頁模板的外框覆寫 FK 指向頁首 / 頁尾,所以那兩張先建。
--
-- 註:JSONB 依約定不放裸頂層 array —— content 存 {"blocks": [...]},
--     API 對外仍以陣列呈現(adapter 映射)。

CREATE TABLE tenants (
    tenant_id  UUID PRIMARY KEY,
    -- 店號:後台選店用(v1 不驗證身分,輸入即進站)
    code       TEXT NOT NULL UNIQUE,
    -- 前台由主機名解析租戶
    domain     TEXT UNIQUE,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 頁首模板 ────────────────────────────────────────────────────────────

CREATE TABLE header_templates (
    header_template_id UUID PRIMARY KEY,
    tenant_id          UUID NOT NULL REFERENCES tenants (tenant_id),
    name               TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'active', 'paused')),
    -- 站台預設:全站標準用哪一份。每租戶至多一份(下方 partial unique index)
    is_site_default    BOOLEAN NOT NULL DEFAULT false,
    content            JSONB NOT NULL DEFAULT '{"blocks": []}'::jsonb,
    version            BIGINT NOT NULL DEFAULT 0,
    note               TEXT,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at       TIMESTAMPTZ,
    -- 供首頁模板做「同租戶」複合 FK 的目標(見 home_page_templates)
    UNIQUE (tenant_id, header_template_id)
);
CREATE INDEX idx_header_templates_tenant ON header_templates (tenant_id);
CREATE UNIQUE INDEX uniq_header_templates_site_default
    ON header_templates (tenant_id) WHERE is_site_default;

-- ── 頁尾模板 ────────────────────────────────────────────────────────────
-- 形狀與頁首相同,但刻意分表:兩者不是同一類東西,只是恰好現在欄位一樣。

CREATE TABLE footer_templates (
    footer_template_id UUID PRIMARY KEY,
    tenant_id          UUID NOT NULL REFERENCES tenants (tenant_id),
    name               TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'active', 'paused')),
    is_site_default    BOOLEAN NOT NULL DEFAULT false,
    content            JSONB NOT NULL DEFAULT '{"blocks": []}'::jsonb,
    version            BIGINT NOT NULL DEFAULT 0,
    note               TEXT,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at       TIMESTAMPTZ,
    UNIQUE (tenant_id, footer_template_id)
);
CREATE INDEX idx_footer_templates_tenant ON footer_templates (tenant_id);
CREATE UNIQUE INDEX uniq_footer_templates_site_default
    ON footer_templates (tenant_id) WHERE is_site_default;

-- ── 首頁模板 ────────────────────────────────────────────────────────────
-- 每租戶可有多份(常態版 / 周年慶版 / 會員版…),哪份生效由 targeting 於渲染時解析。
-- v1 不放 slug:首頁網址恆為 '/',而同一網址本來就對多份模板 —— slug 不是模板的屬性。

CREATE TABLE home_page_templates (
    home_page_template_id UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL REFERENCES tenants (tenant_id),
    name                  TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'active', 'paused')),
    -- 常態版:不設條件、優先序最低、永久兜底。每租戶恰一份 → 畫面不會開天窗
    is_fallback           BOOLEAN NOT NULL DEFAULT false,
    seo_title             TEXT,
    seo_description       TEXT,
    -- 生效條件 {schedule, audience, source, priority};後端此刻不解讀(M4 才用)
    targeting             JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- 外框覆寫:兩個獨立 FK,可各自指定;NULL = 跟隨站台預設。
    -- 這是分表的紅利 —— 單表時代只能是 chrome JSONB {headerId, footerId},
    -- 引用完整性沒地方掛,得靠應用層自己查「這個 id 存在嗎」。
    -- 複合 FK 帶 tenant_id:順帶擋掉跨租戶引用(A 店的首頁指到 B 店的頁首)。
    header_template_id    UUID,
    footer_template_id    UUID,
    content               JSONB NOT NULL DEFAULT '{"blocks": []}'::jsonb,
    version               BIGINT NOT NULL DEFAULT 0,
    note                  TEXT,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at          TIMESTAMPTZ,
    FOREIGN KEY (tenant_id, header_template_id)
        REFERENCES header_templates (tenant_id, header_template_id),
    FOREIGN KEY (tenant_id, footer_template_id)
        REFERENCES footer_templates (tenant_id, footer_template_id)
);
CREATE INDEX idx_home_page_templates_tenant ON home_page_templates (tenant_id);
CREATE UNIQUE INDEX uniq_home_page_templates_fallback
    ON home_page_templates (tenant_id) WHERE is_fallback;

-- ── 異動紀錄(三張,各自跟著自己的實體) ──────────────────────────────────
-- v1 無帳號系統,先不記 who。不設 FK 到模板:模板刪除後仍要留痕。
-- 動作集三張各不相同 —— 這也是分表才拿得到的精準度:
--   首頁有 priority(生效條件才有優先序),沒有 set-site-default;
--   頁首 / 頁尾反之。

CREATE TABLE home_page_template_audits (
    audit_id              UUID PRIMARY KEY,
    tenant_id             UUID NOT NULL REFERENCES tenants (tenant_id),
    home_page_template_id UUID NOT NULL,
    action                TEXT NOT NULL CHECK (action IN
                              ('create', 'save-draft', 'publish', 'duplicate',
                               'priority', 'pause', 'resume')),
    detail                TEXT,
    at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_home_page_template_audits
    ON home_page_template_audits (home_page_template_id, at DESC);

CREATE TABLE header_template_audits (
    audit_id           UUID PRIMARY KEY,
    tenant_id          UUID NOT NULL REFERENCES tenants (tenant_id),
    header_template_id UUID NOT NULL,
    action             TEXT NOT NULL CHECK (action IN
                           ('create', 'save-draft', 'publish', 'duplicate',
                            'pause', 'resume', 'set-site-default')),
    detail             TEXT,
    at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_header_template_audits
    ON header_template_audits (header_template_id, at DESC);

CREATE TABLE footer_template_audits (
    audit_id           UUID PRIMARY KEY,
    tenant_id          UUID NOT NULL REFERENCES tenants (tenant_id),
    footer_template_id UUID NOT NULL,
    action             TEXT NOT NULL CHECK (action IN
                           ('create', 'save-draft', 'publish', 'duplicate',
                            'pause', 'resume', 'set-site-default')),
    detail             TEXT,
    at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_footer_template_audits
    ON footer_template_audits (footer_template_id, at DESC);

-- ── 其他 ────────────────────────────────────────────────────────────────

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
