//! Outbound ports (traits implemented by infra adapters).
//!
//! Write side: IssuanceRepository, CustomerPointsRepository, GrantTaskPublisher,
//!             RecipientListStore (streaming read/write, file:// -> gs://).
//! Read side:  query ports returning read models directly.
//!
//! Implementation lands in the next iteration.
