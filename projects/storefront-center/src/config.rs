//! 執行設定,從環境變數載入。

use std::net::SocketAddr;

#[derive(Debug, Clone)]
pub struct Config {
    /// 監聽位址(`BIND_ADDR`,預設 `0.0.0.0:3000`)。
    pub bind_addr: SocketAddr,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let bind_addr = std::env::var("BIND_ADDR")
            .unwrap_or_else(|_| "0.0.0.0:3000".to_string())
            .parse()?;
        Ok(Self { bind_addr })
    }
}
