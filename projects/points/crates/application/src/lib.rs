//! Application layer: use case interactors (CQRS) + ports.
//!
//! - `commands/`: state-changing interactors (go through domain, own tx boundary)
//! - `queries/`: read-only interactors (project straight to read models)
//! - `ports/`: outbound traits implemented by infra adapters
//!
//! See docs/plan/01-points-center-spec.md §4.3.

pub mod commands;
pub mod ports;
pub mod queries;
