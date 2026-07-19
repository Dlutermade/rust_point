# 0002 — 結構定案與依賴就緒

> 日期:2026-07-19。承接 0001。

## 狀態

- 規格與佈局全面定案,皆待審查。
- 依賴表實作就緒;程式碼仍是骨架(`IssuanceStatus` 狀態機,3 單測)。

## 本階段決策(一行一決策;細節以右欄文件為準)

| 決策 | 細節在 |
|------|--------|
| context 更名:`points` → `point-center` | tech/02 |
| 兩層結構:context 各自成家;context 內 PbC × 六角(C2) | tech/02 |
| 一 project 一 Cargo workspace,root 無 Cargo.toml | tech/02 |
| apps 拆四:internal-api / storefront-api / grant-worker / expiry-job | tech/02 |
| 容器引擎 podman 優先;否決原生直裝 NATS/PG | tech/02 |
| 上傳協定 = GCS resumable dialect(為 v2 client 直傳鋪路) | api.md UC-1 |
| 多租戶:`shop_id` 進三表、所有唯一鍵之首、API 路徑前綴 | api.md、internals.md |
| 軟刪除:無物理 DELETE;`:cancel`;兌換明細升子表 | api.md、internals.md |
| 到期流程:expiry-job 單次清掃;tx 內發 `points.batch.expired` | internals.md |
| NATS 事件 payload 為公開合約(三事件 + 去重鍵) | api.md「NATS 事件」 |
| 觀測 = OTel:v1 接線、未設 endpoint 靜默停用、span links | tech/03 |
| 對帳方向:v1 不變量 SQL;append-only 增量 ETL 免 CDC | internals.md |
| 文件規約:精簡現在式、一行一事實、一事實一出處 | tech/01 §工程規約 |
| 版本全釘滿:crates 完整版號、PG 18.4、NATS 2.14.3 | tech/01 §版本錨點、tech/03 §7 |
| 事件中心(跨 context)列未排程議題 | plan/backlog.md |

## 驗證狀態

- Rust 1.97.1(GNU host)+ MinGW 裝於 `D:\rust`(C 槽保留)。
- check / test 3/3 / clippy / fmt 全綠;`cargo tree -d` 無版本分裂。
- 此機無容器(虛擬化未開);整合驗收在 Mac(Podman)跑。

## 下一步

實作自 `ledger-core` 純函式開始 TDD(FIFO 分攤、生效窗換算、交易不變量),再 ports → adapters → apps 組裝;整合驗收在 Mac。
