# 06 — 資料存取

> 技術視角 · **擺最後**。DB(Postgres + JSONB)+ 快取 + 物件儲存。
> **熱讀路徑走快取、不打 DB**;DB 只是編輯 / 發布的權威 store。先規劃、不實作。⚠️ DDL 為草案。

## 儲存分工

| 資料 | 落點 |
|------|------|
| 頁面(區塊樹)、區段組、全站設定、版本 | **PostgreSQL(JSONB)** |
| 已編譯 render plan / 已渲染 HTML 片段 | 快取(moka L1 + Valkey L2);可重建 |
| 圖片資產本體 | **GCS**(prod)/ **FS**(dev) |
| feature store(推薦 / 排序,v3) | **Valkey** |

## Schema(草案)

```sql
CREATE TABLE tenants (tenant_id UUID PRIMARY KEY, domain TEXT UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 頁面實例(草稿 + 發布同列)
CREATE TABLE pages (
    page_id         UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    page_type       TEXT NOT NULL,       -- home / campaign / custom …
    slug            TEXT NOT NULL,       -- 網址
    seo             JSONB,               -- {title, description, …}
    draft           JSONB NOT NULL,      -- 區塊樹(編輯中)
    published       JSONB,               -- 區塊樹(上線版);NULL = 未發布
    publish_version BIGINT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'draft',  -- draft / published
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at    TIMESTAMPTZ,
    UNIQUE (tenant_id, slug)
);
CREATE INDEX idx_pages_tenant_type ON pages (tenant_id, page_type);

-- 區段組(header / footer / 公告;每租戶每型別一份)
CREATE TABLE section_groups (
    tenant_id       UUID NOT NULL,
    group_type      TEXT NOT NULL,       -- header / footer / announcement
    draft           JSONB NOT NULL,
    published       JSONB,
    publish_version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, group_type)
);

-- 全站設定
CREATE TABLE theme_settings (
    tenant_id UUID PRIMARY KEY,
    settings  JSONB NOT NULL             -- {brandColor, font, logo, …}
);

-- 資產 metadata
CREATE TABLE assets (
    asset_id   UUID PRIMARY KEY,
    tenant_id  UUID NOT NULL,
    uri        TEXT NOT NULL,            -- gs://… / file://…
    kind       TEXT, width INT, height INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- 頁面樹存 **JSONB**(文件形狀、整棵讀寫);查詢靠 `tenant / slug / type`,不做樹內關聯查詢。
- 版本:v1 用 `draft` / `published` 兩欄 + `publish_version`;**完整版本歷史(回溯)延後**(屆時另開 `page_versions` 表)。
- **巢狀 ≤5 層是應用層規則**(存進 JSONB 前驗),不靠 DB。

## 快取

- L1 **moka**(TinyLFU)→ L2 **Valkey** → origin。
- 鍵:靜態 `(page, publish_version)`、動態共享 `(block, time_bucket)`、個人化 `(block, segment)`。
- 失效:**發布 → `publish_version++` → 舊鍵自然失效**;區段組發布 → 清引用頁。

## 物件儲存(資產)

- `AssetStore`:dev `file://` → prod `gs://`(URI scheme 自帶語意,呼應 point-center 名單儲存)。
- 圖片上傳走串流;回不可變 URL。
