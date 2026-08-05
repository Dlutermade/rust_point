# 電商後端 monorepo

一個 bounded context 一顆自包含子樹,各自成家:自有 Cargo workspace、自有基礎設施、自有指令。context 之間禁止 Cargo 依賴、禁止共用 DB,只透過公開 API 與事件溝通。

建置順序見 [docs/plan/roadmap.md](docs/plan/roadmap.md):**前台中心 → 商品中心 → 回前台 → 訂單中心 → 回前台 → 商品折扣**。前台先立起來當底座,後面每個中心都有地方落地。

## 現況

**建置第 1 步:前台中心(storefront-center)** —— 可客製化的前台頁面系統,頁面 layout 以 Tree 定義,後台可編排內容 / 排版 / 曝光版位。v1 不含登入、商品、結帳。

| 里程碑 | 狀態 |
|--------|------|
| M1 骨架(axum + 設定 + 多租戶解析) | ✅ 多租戶仍是 stub |
| M2 編輯 API | ✅ 跑在記憶體 store 上,**DB 未接** |
| M3 區塊型別系統 | 🟡 前端 9 個 Web Components 已成;Rust 端 SSR 渲染未動 |
| M4 渲染引擎(靜態) | ⬜ 公開頁仍是 placeholder |
| M5 編輯器前端 | 🟡 編輯器已完整,但資料源仍是 mock |
| M6 打通 | ⬜ 前後端尚未接線 |

**紅利點數中心(point-center)** 已規劃完成但 **parked**,實作全數移除,只留商業規格 [docs/plan/01-point-center/](docs/plan/01-point-center/);等前台 / 商品 / 訂單 / 會員就緒後回來接。

## 佈局

```
Makefile             # cargo(storefront-center)+ pnpm(前端)+ compose
pnpm-workspace.yaml  # 前端 workspace:admin + blocks
docs/
  plan/              # 規格:商業視角先行,技術視角後補
  tech/              # 跨 context 技術決策(選型 / 佈局 / 觀測)
  progress/          # 決策軌跡
projects/
  storefront-center/ # bounded context「前台中心」(Rust,自有 Cargo workspace)
    docker-compose.yml # 自有基礎設施:Postgres + Valkey
    migrations/        # Postgres schema —— Model B,尚未套用
    src/
      api/             # 公開頁服務(訪客)+ 編輯 API(商家後台)
      store/           # 資料存取 port(async trait)+ InMemoryStore
      domain.rs        # 模板 / 狀態 / 版位
      tenant.rs        # 多租戶解析(stub)
  admin/             # 編輯器前端(React + Antd + TanStack)
  blocks/            # 區塊庫(Lit Web Components,@sc/blocks)
```

資料存取藏在 `Store` async trait 後,Postgres(sqlx)adapter 之後替換不動 API 層。狀態機與不可變性規則(已發布凍結、常態版不可暫停 / 刪除、每版位單一站台預設)現在寫在 store 實作裡,換 PG 時搬進 SQL / 交易。

## 技術棧

| 層面 | 選型 |
|------|------|
| Runtime / HTTP | tokio + axum |
| 前台渲染 | 純 Rust SSR(Maud / Askama)+ render plan 編譯(M4) |
| 資料庫 | PostgreSQL + JSONB + sqlx |
| 快取 | moka(行程內)+ Valkey(共享) |
| 編輯器 | React + Antd + TanStack Router / Query(pnpm) |
| 區塊 | Lit Web Components |
| 資產 | GCS / 本機 FS |
| ID | UUID v7 |
| 觀測 | tracing + OpenTelemetry |

完整理由與替代方案:[docs/tech/01-tech-stack.md](docs/tech/01-tech-stack.md)、[02-storefront-center/technical/01-decisions.md](docs/plan/02-storefront-center/technical/01-decisions.md)

## 文件

| 系列 | 內容 |
|------|------|
| [docs/plan/](docs/plan/) | 規格。每個 context 一個編號資料夾,`business/`(PO 觀點、零技術)先行,`technical/` 後補 |
| [docs/tech/](docs/tech/) | 跨 context 技術決策紀錄 |
| [docs/progress/](docs/progress/) | 決策軌跡(現在式規格 + 過程分離) |
| [docs/plan/backlog.md](docs/plan/backlog.md) | 跨 context、未排程的議題池 |

文件採編號迭代,**先審查後實作**。

## 開發

```bash
make web-install   # 安裝前端相依(pnpm workspace)
make up            # 起 storefront-center 的 Postgres + Valkey
make run           # storefront-center,預設 0.0.0.0:3000
make web-dev       # admin 編輯器(先 build blocks,再起 vite)
make check         # cargo check
make test          # cargo test(⚠️ 目前 0 個測試)
make lint fmt      # Rust:clippy / rustfmt
make web-lint      # 前端:oxlint(web-fmt / web-fmt-check 同理)
make psql          # 資料庫 shell
```

**兩套工具鏈各管各的**:Rust 走 cargo(clippy / rustfmt),前端走 oxlint + oxfmt。前端設定只有 root 這一份(`.oxlintrc.json` / `.oxfmtrc.json`),指令明確指向 `projects/admin/src` 與 `projects/blocks/src`,不會走進 Rust 專案。

**基礎設施一 context 一份 compose**,住在 `projects/<name>/docker-compose.yml`;root 沒有 compose —— 現在沒有任何跨 context 共用的東西。等第二個訂閱方 context 進場,跨 context 事件骨幹才會以共用 compose 回到 root(見 [backlog](docs/plan/backlog.md))。

容器引擎自動偵測(**podman 優先**,否則 docker),可覆寫:`make up COMPOSE="docker compose"`。PG host port 預設 5433(避開開發機上常被佔用的 5432),可用 `SF_PG_PORT` 覆寫。

## 下一步

1. M2 code review
2. admin 的 `api/mock.ts` → 打真後端(前後端打通)
3. 接 sqlx adapter,把 migration 交給它管(PG 已就位:`make up`)
4. M3 Rust 端渲染 + M4 渲染引擎
