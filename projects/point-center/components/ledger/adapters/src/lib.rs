//! Ledger component — technology adapters.
//!
//! - PostgreSQL: pessimistic / optimistic redeem strategies (`REDEEM_STRATEGY`),
//!   chunked idempotent bulk grant (`ON CONFLICT DO NOTHING`), read-side
//!   query adapters, migrations
//! - NATS: expiry events (`points.batch.expired`, versioned wire DTOs)
//!
//! Implementation lands in the next iteration.
