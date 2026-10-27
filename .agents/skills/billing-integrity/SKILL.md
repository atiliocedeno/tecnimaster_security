---
name: billing-integrity
description: Preserve accurate, auditable and idempotent recurring billing, payments, vehicle rates, renewals and SaaS subscriptions.
---
# Billing Integrity
Inspect `server/collections.mjs`, `server/transactions.mjs`, migrations, existing invoices and tests before editing.

## Procedure
1. Separate Bricks subscription revenue from each tenant's charges to its customers.
2. Store CLP amounts as integers; document rounding and inclusive/exclusive IVA.
3. Snapshot historical prices and due dates; preserve existing financial history.
4. Use transactional payment posting/reversals, idempotency keys, uniqueness constraints and audit events.
5. Never delete debts when a customer is retired; use reversible, traceable changes.
6. Test partial/duplicate payments, renewals, multi-vehicle prices, reversals, time boundaries and cross-tenant isolation.

## Completion
Report invariants, actual tests and remaining issues. Never charge live customers or migrate live data without explicit approval.
