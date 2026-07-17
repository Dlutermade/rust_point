//! Infra layer: outbound adapters (Gateways).
//!
//! - PostgreSQL: repositories (pessimistic/optimistic redeem strategies,
//!   chunked bulk grant inserts) + read-side query adapters
//! - NATS JetStream: issuance task publishing/consuming, terminal-state events
//! - Recipient list store: v1 local filesystem (file://), production GCS (gs://)
//! - wire DTOs (versioned, e.g. IssuanceTaskV1)
//!
//! Implementation lands in the next iteration.
