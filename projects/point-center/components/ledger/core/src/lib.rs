//! Ledger component — core (the points ledger).
//!
//! Business capability: customer point batches, transactions, FIFO
//! allocation (domain service), redeem / grant / expire use cases and
//! the balance / transaction read views. Outbound ports (write side + read side)
//! are defined here and implemented by `point-center-ledger-adapters`.
//!
//! Compile-enforced: no tokio, no sqlx, no NATS in this crate —
//! allocation, window conversion and invariants are pure functions.
//! Only the component's public API is exported; internals stay private.

mod deduction;
mod effective_window;
mod transaction_type;

pub use deduction::{CustomerPoint, Deduction, DeductionError, deduct};
pub use effective_window::{EffectiveWindow, EffectiveWindowError, EffectiveWindowPhase, Expiry};
pub use transaction_type::{TransactionType, TransactionTypeError};
