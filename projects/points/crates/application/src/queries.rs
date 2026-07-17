//! Query interactors, one per read-only UC:
//! GetCustomerPoints, ListTransactions, GetIssuance.
//!
//! Read-only: no locks, no tx, no aggregate rebuilding — straight to read models.
//! Implementation lands in the next iteration.
