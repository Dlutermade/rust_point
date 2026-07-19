# 0001 — 規格定案與 workspace 骨架

> 日期:2026-07-17。

## 狀態

規格與選型初版定案(當時為單檔 spec);workspace 骨架建立,build / test 綠;未實作功能。

## 要點

- 已發布 GitHub:`Dlutermade/rust_point`(main)。
- 流程約定:文件先審後做;**commit 前必問使用者**。
- 初始佈局(`projects/points`、層式 crates)與命名——**已由 0002 全面重構取代**,現況以 0002 與 tech/02 為準。
- 骨架驗證:`cargo build / test` 通過(domain 狀態機單測)。
