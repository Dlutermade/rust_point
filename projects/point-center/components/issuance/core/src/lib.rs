//! Issuance component — core (the issuance flow).
//!
//! Business capability: issuance lifecycle (draft → … → completed | failed),
//! recipient upload sessions (GCS resumable dialect), effective/expiry
//! window conversion, task-processing orchestration and the progress read view.
//! Grants points through the ledger component's public API — the only
//! cross-component edge: `issuance-core → ledger-core`.
//!
//! Compile-enforced: no tokio, no sqlx, no NATS in this crate.

mod expiration_policy;
mod issuance;
mod issuance_status;
mod ports;

pub use expiration_policy::{ExpirationPolicy, ExpirationPolicyError};
pub use issuance::{
    FailureReason, Issuance, IssuanceError, NewIssuance, RecipientList, StoredIssuance,
    UploadSession,
};
pub use issuance_status::{IssuanceStatus, IssuanceStatusError};
pub use ports::{
    IssuanceCompleted, IssuanceEventError, IssuanceEventPort, IssuanceFailed, IssuanceRepository,
    IssuanceRepositoryError, IssuanceTask, PartLocation, RecipientListStore,
    RecipientListStoreError,
};
