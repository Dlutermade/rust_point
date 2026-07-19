//! Ledger component — core (the points ledger).
//!
//! Business capability: customer point batches, transactions, FIFO
//! allocation (domain service), redeem / grant / expire use cases and
//! the UC-3/UC-4 read views. Outbound ports (write side + read side)
//! are defined here and implemented by `point-center-ledger-pg`.
//!
//! Compile-enforced: no tokio, no sqlx, no NATS in this crate —
//! allocation, window conversion and invariants are pure functions.
//! Only the component's public API is exported; internals stay private.
