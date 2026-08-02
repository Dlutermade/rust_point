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

## 之後需要的 infra(本機無 Docker,待張羅)

- **PostgreSQL**(權威 store)、**Valkey**(快取 / feature store,不用 Redis)。
- 編輯器前端:React + Antd + TanStack(**Node 26 + pnpm**)。
