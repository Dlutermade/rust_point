//! 多租戶解析。兩條路徑,來源不同:
//!
//! - **前台(訪客)**:由請求主機名對應 `tenants.domain`。
//! - **後台(商家)**:由 `X-Tenant-Code` header 帶店號對應 `tenants.code`。
//!   v1 **不驗證身分** —— 輸入店號即進站,沒有帳號系統(見 business/01-scope)。
//!   刻意不叫 login / auth:那會誘使後人往上加 token 邏輯,而這裡什麼都沒驗。
//!
//! 兩條都還是 stub:`tenants` 表尚未接資料存取,現在所有請求都掛在
//! `store::DEFAULT_TENANT` 底下。

use uuid::Uuid;

#[allow(dead_code)] // 接上 tenants 資料存取後才會被建構
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TenantId(pub Uuid);

/// 前台:由主機名解析租戶(stub:永遠回 `None`)。
pub fn resolve_from_host(_host: &str) -> Option<TenantId> {
    None
}

/// 後台:由店號解析租戶(stub:永遠回 `None`)。
#[allow(dead_code)] // 選店流程接上後才會被呼叫
pub fn resolve_from_code(_code: &str) -> Option<TenantId> {
    None
}
