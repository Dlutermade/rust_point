# storefront-center

可客製化的前台頁面系統(Rust)。規格見 [`docs/plan/02-storefront-center/`](../../docs/plan/02-storefront-center/)。

## 現況

- **M1 骨架**:axum 伺服器 + 設定 + 多租戶解析(stub)+ 路由分組(公開頁服務 `/`、編輯 API `/api`)。
- **M2 編輯 API(進行中)**:頁面模板 CRUD / 草稿 / 發布 / 狀態,對齊 admin 前端契約(Model B:每版位多模板 + targeting + 站台預設)。
  - 資料存取先用 **記憶體 store**(不接 DB),藏在 `Store` port 後 —— Postgres(sqlx)adapter 之後替換,不動 API 層。
  - 狀態機 / 不可變性:已發布凍結、常態版不可暫停 / 刪除、每版位至多一個站台預設。
  - schema 見 `migrations/0001_init.sql`(**尚未套用**;等 Postgres 到位)。
- 渲染引擎(M4)、編輯器前端(M5,另見 `projects/admin`)隨里程碑補上。

## 編輯 API

輸出 JSON 為 camelCase,對上前端型別。多租戶解析仍是 stub,暫掛單一預設租戶。

```
GET    /api/slots/{slot}/templates          # 列表(slot = home|header|footer)
POST   /api/slots/{slot}/templates          # 建草稿 {name}
GET    /api/slots/{slot}/active-content      # 站台預設外框內容(resolveChrome)
GET    /api/templates/{id}                   # 實體(含 content)
PATCH  /api/templates/{id}/draft             # 存草稿 {name?,content?,targeting?,chrome?}(僅草稿)
POST   /api/templates/{id}/publish           # 發布 {content?,targeting?}
POST   /api/templates/{id}/pause | /resume   # 暫停 / 恢復
PUT    /api/templates/{id}/priority          # 調優先序 {priority}
POST   /api/templates/{id}/default           # 設站台預設(頁首 / 頁尾)
DELETE /api/templates/{id}                   # 刪除(常態版 / active 不可)
GET    /api/templates/{id}/audit             # 異動紀錄
GET    /api/templates/{id}/content           # 內容(區塊樹)
```

## 執行

```
cargo run                              # 預設監聽 0.0.0.0:3000
curl localhost:3000/healthz            # ok
curl localhost:3000/api/slots/home/templates   # 種子資料
```

`BIND_ADDR` 覆寫監聽位址。

## Infra

本 context 自有一份 [`docker-compose.yml`](docker-compose.yml)(一 context 一 compose,不與別的 context 共用 DB):

```
make up      # PostgreSQL(權威 store)+ Valkey(快取 / feature store,不用 Redis)
make psql    # 進資料庫 shell
make down
```

host port 預設 **PG 5433**(5432 在開發機上常被別的專案佔著)、**Valkey 6379**,可用 `SF_PG_PORT` / `SF_VALKEY_PORT` 覆寫。連線字串見 [`.env.example`](.env.example)。

`migrations/0001_init.sql` 已對 PG 18 驗證可套用,但**刻意留白不自動套** —— migration 由之後的 sqlx adapter 接管(比照 point-center 的 `platform/db` 做法),現在手動套會擋住它。

編輯器前端在 [`projects/admin`](../admin/)(React + Antd + TanStack),區塊庫在 [`projects/blocks`](../blocks/)。
