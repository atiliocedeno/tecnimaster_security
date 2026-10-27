---
name: qa-release
description: Enforce test coverage, release evidence, migration safety, security, performance and readiness gates for Bricks.
---
# QA & Release
Read roadmap, package.json, docs/qa, existing tests and migration scripts.

## Procedure
1. Define acceptance criteria and unit/integration/API/E2E coverage for changed features.
2. Always test tenant isolation, authorization, sessions, payment/webhook idempotency, concurrency and rollback.
3. Use synthetic/anonymized data and isolated PGlite/PostgreSQL test databases.
4. Run `npm test`, `npx tsc --noEmit`, and `npm run build`; never claim runs that weren't executed.
5. Validate backup restoration and migration rehearsal before releases.
6. Document security/privacy checks, reproducible failures, risks, release gate and rollback.

## Completion
Deliver test evidence and clear go/no-go; no deployment, real data mutation or automatic push.
