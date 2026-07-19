//! Issuance component — technology adapters.
//!
//! - NATS JetStream: issuance task publishing/consuming, terminal-state
//!   events, versioned wire DTOs (e.g. `IssuanceTaskV1`)
//! - Recipient list store: v1 local filesystem (`file://`), production GCS (`gs://`)
//! - PostgreSQL: issuance repository (lifecycle, upload session, progress)
//!
//! Implementation lands in the next iteration.
