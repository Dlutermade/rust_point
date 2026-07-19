# 0003 — Domain 純函式(ledger-core / issuance-core)

> 日期:2026-07-19。承接 0002。

## 狀態

- 兩個 component 的 core 純函式完成並通過 review;27 單測全綠。
- adapters / apps 仍是骨架;唯一跨 component 邊 `issuance-core → ledger-core` 已成立。

## 本階段決策(一行一決策;細節以右欄為準)

| 決策 | 細節在 |
|------|--------|
| 永久點入 domain:`Expiry::{On, Never}`,derived Ord 即扣減順序(快到期在前、永久墊底,variant 順序承重,測試釘住) | ledger `effective_window.rs` |
| DB 端永久 = `'infinity'::timestamptz`(NOT NULL 保留,SQL 零特判) | internals.md |
| 生效窗半開區間 `[生效, 到期)`;三態 Pending / Active / Expired 單一決策表 | ledger `effective_window.rs` |
| 扣減 = `deduct` 純函式:快到期先扣、跨筆分攤、餘額不足整筆拒絕 | ledger `deduction.rs` |
| 扣減次鍵 = `customer_point_id`(UUID v7 時間有序,與兌換 SQL 鎖序一致、必不平手) | ledger `deduction.rs` |
| 負剩餘 = 帳本損毀:一次回報全部損毀列,對外 500、細節只進 log 與告警 | ledger `deduction.rs` |
| 交易符號規則:grant 正 / redeem·expire 負 / adjust 非零;Display 即 DB 字串 | ledger `transaction_type.rs` |
| 到期方式二選一:`expireOnDate` / `expireNever`;相對天數由呼叫端換算(拔掉 `expireAfterDays`) | api.md UC-1、issuance `expiration_policy.rs` |
| 時鐘注入:domain 不讀時鐘,`now` 由呼叫端傳入 | issuance `expiration_policy.rs` |
| 狀態機三守衛:upload(draft/failed)、issue(→pending)、cancel(draft 軟刪) | issuance `issuance_status.rs` |
| 風格規約:FP 組合子優先、名稱不洩漏實作手段、窮盡 match 無萬用臂、錯誤型別/檔名用全名 | tech/01 §工程規約 |
| 測試規約:given/when/then 註解、自描述字面值(RFC 3339 字串) | 各 `#[cfg(test)]` |

## 驗證狀態

- test 27/27(ledger 19 + issuance 8)/ clippy `-D warnings` / fmt 全綠。
- sqlx 的 `'infinity'` ↔ chrono 往返留待 adapter 階段整合測試。

## 下一步

`Issuance` 聚合(私有 status 收口狀態機、上傳 session 規則)→ ports → adapters → apps 組裝;整合驗收在 Mac。
