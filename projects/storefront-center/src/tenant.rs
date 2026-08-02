//! 多租戶解析:由請求主機名對應到租戶。
//! M1 為 stub;`tenants.domain` 對照表於 M2 接資料存取。

use uuid::Uuid;

#[allow(dead_code)] // M2 接對照表後才會被建構
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TenantId(pub Uuid);

/// 由主機名解析租戶(M1 stub:永遠回 `None`)。
pub fn resolve_from_host(_host: &str) -> Option<TenantId> {
    None
}
