# 0003 — 清殘留、修工具鏈、infra by project

> 日期:2026-08-05。轉向 storefront-center 後的環境收尾,未動業務邏輯。

## 狀態

- **殘留清掉**(釋出 4.5G):`projects/point-center/`(只剩 build cache,原始碼在 0001 已移除)、root `target/`(root 早已無 Cargo.toml)、admin / blocks 各自的 `pnpm-lock.yaml`(pnpm workspace 只認 root lock,這兩份被追蹤卻永不更新)。
- **Makefile 修好**:原本每個 target 都 delegate 到已不存在的 `projects/point-center/Makefile`,`make build` / `test` / `lint` 全數失敗。重寫成 cargo(走 `--manifest-path`)+ pnpm 兩段,新增 `run` / `web-install` / `web-build` / `web-dev` / `psql`。
- **infra 到位**:`projects/storefront-center/docker-compose.yml` = Postgres 18.4 + Valkey 9.1.1,兩者皆有 healthcheck,`make up` 實測起得來。
- 前端相依已安裝,blocks + admin build 通過;clippy 零 warning。
- 文件對齊現況:root README 整份重寫(原本從標題到 Roadmap 全是 point-center 的)、admin README(原為 Vite 樣板原文)、新增 blocks README。

## 決策

- **compose 一 context 一份**,住 `projects/<name>/docker-compose.yml`。root 不留 compose —— 現階段沒有任何跨 context 共用的東西;跨 context 事件骨幹等第二個訂閱方進場再以共用 compose 回到 root(見 [backlog](../plan/backlog.md))。
- **PG host port 預設 5433**:5432 在開發機上常被別的專案佔著。`SF_PG_PORT` / `SF_VALKEY_PORT` 可覆寫。
- **migration 不手動套**:`0001_init.sql` 已對 PG 18 驗證可完整套用(8 個物件全建起來),但驗證後把 schema 還原留白 —— migration 交給之後的 sqlx adapter 管(比照 point-center 的 `platform/db`),先手動套會讓它在 0001 撞 already exists。
- **rustfmt 用預設**:不加 `rustfmt.toml`;這輪順手把從未 fmt 過的三個檔重排掉,之後 `make fmt` 冪等。

## 註

`postgres:18` 的 PGDATA 搬到 `/var/lib/postgresql/18/docker`,image 宣告的 volume 是上一層 —— 照 pre-18 習慣掛 `/var/lib/postgresql/data` 會**靜默不持久化**。已實測寫入 → `down` → `up` → 資料仍在。

## 下一步

- **M2 code review**(0002 就列了,仍未做)。
- admin `mock.ts` → 打真後端(前後端打通);接 sqlx adapter;M3 Rust 端渲染 + M4 渲染引擎。
- 未補的缺口:Rust 側 **0 個測試**、多租戶解析仍是 stub。
