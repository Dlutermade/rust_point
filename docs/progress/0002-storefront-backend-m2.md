# 0002 — storefront-center 後端 M2:編輯 API(記憶體 store)

> 日期:2026-08-03。

## 狀態

- `projects/storefront-center`(Rust / axum)接上**編輯 API**,一比一對齊 admin 前端契約(Model B)。
- 資料存取藏在 `src/store` 的 **`Store` async trait(port)** 後,現用 `InMemoryStore`(種子資料);**DB 未接**(本機無 Postgres),`migrations/0001_init.sql` 重寫成 Model B 但**尚未套用**。
- 端點:list / create / get / save-draft / publish / pause / resume / priority / default / remove / audit / content / active-content。輸出 camelCase。
- 狀態機 / 不可變性:已發布凍結、常態版不可暫停 / 刪除、每版位單一站台預設。以 `curl` 端到端驗過(建→存→發布→凍結 409→常態版擋暫停 409→設預設互斥→audit 順序)。

## 決策

- **先不接 DB**:in-memory 起步,`Store` port 抽象讓 Postgres(sqlx)adapter 之後替換,不動 API 層。
- schema 重寫為 **Model B**(`templates` + `template_audit`),取代早期 `pages` / `section_groups`。JSONB 依約定不放裸 array:`content` 存 `{"blocks":[...]}`,API 對外仍回陣列(adapter 映射)。
- 多租戶解析仍是 stub,暫掛單一 `DEFAULT_TENANT`。

## 下一步

- **code review(下一輪)**。
- 之後:admin `mock.ts` → 打真後端(前後端打通)、接 Postgres adapter(需先定 PG 從哪來)、M3 區塊型別 + M4 SSR 渲染。
