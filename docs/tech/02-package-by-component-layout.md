# 02 — 佈局:context 各自成家 × Package by Component

> 狀態:**待審查**。

## 決策

**1. monorepo 層 = bounded context 各自成家**

- `projects/<context>` 自包含:components、apps、自有 compose / Makefile / DB / Cargo workspace。
- root 無 Cargo.toml。
- context 間禁止 Cargo 依賴、禁止共用 DB;只走公開 API + NATS 事件。
- 未來 context:`order`、`member`、`dispatch`。

**2. context 命名描述系統角色**

- `point-center`,不用領域概念名(`points` 保留給領域語彙)。

**3. context 內 = Package by Component × 六角(C2)**

- `components/<能力>/{core, adapters}`。
- component 只暴露公開 API(crate 可視性強制)。
- core ⊥ tokio/sqlx/NATS(Cargo 不列,編譯期強制)。
- `apps/` 是 shell:Controller/Presenter + composition root(`Arc<dyn Trait>` 注入)。

**4. 基礎設施歸屬**

- root compose 只放共享 NATS。
- 各 context 自有 DB;PG host port 依進場順序(5432、5433…)。

**5. Makefile 兩層**

- root:共享 infra + 逐 project 轉發。
- context:自持全部指令(up/down/api/worker/build/test/lint)。
- `COMPOSE ?=` 自動偵測,podman 優先、docker fallback,可 CLI 覆寫。
- 不採原生直裝服務:隔離與宣告式生命週期優先。

**6. 命名**

- crate:`{context}-{component}-{part}`;app:`{context}-{app}`。
- rust-analyzer 以 `.vscode/settings.json` 的 `linkedProjects` 掛載各 workspace。

## point-center 的 components

| component | core | adapters |
|-----------|------|----------|
| **ledger** | 批次、交易、FIFO、redeem/grant/expire、UC-3/4 views、ports | `adapters`:pg(兩種兌換策略、批量入帳、讀側、migrations)+ NATS(到期事件) |
| **issuance** | 狀態機、上傳 session、create/upload/issue/process、UC-5 view、ports | `adapters`:NATS wire、名單儲存、issuance repo |

跨 component 唯一的邊:`issuance-core → ledger-core`(grant API)。

## 否決的替代案

- 層式 crate + 能力 module:能力邊界只是資料夾名,編譯器不背書。
- core + infra 兩顆:domain / use case 邊界退化成自律。
- 教科書 PbC 單 crate:core ⊥ 技術失守。
- 基礎設施集中 root、延後拆分、compose `include:`:與各自成家矛盾。

## 佈局

```
Makefile  docker-compose.yml(NATS)  .vscode/settings.json
projects/point-center/
  Cargo.toml + Cargo.lock          # 自己的 workspace
  docker-compose.yml(PG)  Makefile
  components/
    ledger/{core, adapters}
    issuance/{core, adapters}
  apps/                            # shell:依呼叫者/擴縮特性切
    internal-api/                  # 後台:UC-1/5/6(發點生命週期)
    storefront-api/                # 前台系統串接:UC-2/3/4(兌換/餘額/交易)
    grant-worker/                  # NATS consumer(入帳管線)
    expiry-job/                    # 到期清掃(run-to-completion,小時級)
    hold-timeout-job/              # 逾時預留取消(分鐘級,獨立節奏)
```

apps 增生只在 `apps/` 加資料夾、components 零改動;能力夠獨立則畢業成新 context。
