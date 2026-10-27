---
name: saas-tenancy
description: Design and validate tenant isolation, identity, RBAC and sessions for Bricks SaaS.
---
# SaaS Tenancy
Read `docs/BRICKS-SAAS-ROADMAP.md`, `README.md`, `server/auth.mjs`, `server/handler.mjs`, schema/migrations and tests.

## Procedure
1. Inventory every data access path and entity belonging to a company.
2. Produce an ADR before architectural refactoring or backend replacement.
3. Model organizations, memberships, users and revocable sessions. Derive tenant from authenticated membership, never unchecked request input.
4. Scope every SQL query, mutation, import, export and background job; consider PostgreSQL RLS as defense in depth.
5. Preserve legacy TecniMaster data using additive migrations and rehearsal on anonymized copies.
6. Verify denial by default for both RBAC and tenant access, including forged IDs, timing/concurrency and pagination.

## Completion
Provide changes, security test evidence, migration plan and risks. Never modify production or commit/push unless explicitly requested.
