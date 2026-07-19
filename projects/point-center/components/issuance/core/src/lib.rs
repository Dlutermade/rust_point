//! Issuance component — core (the issuance flow).
//!
//! Business capability: issuance lifecycle (draft → … → completed | failed),
//! recipient upload sessions (GCS resumable dialect), effective/expiry
//! window conversion, task-processing orchestration and the UC-5 read view.
//! Grants points through the ledger component's public API — the only
//! cross-component edge: `issuance-core → ledger-core`.
//!
//! Compile-enforced: no tokio, no sqlx, no NATS in this crate.

pub mod status;

pub use status::{IssuanceStatus, StatusError};
