---
name: webhook-automation
description: Build secure webhooks, scheduled jobs, event delivery, notification providers and reliable background processing.
---
# Webhook Automation
Read `docs/BRICKS-SAAS-ROADMAP.md`, existing API modules and database changes first.

## Procedure
1. Distinguish cron/scheduled jobs from incoming or outgoing webhooks.
2. Incoming: verify provider signature, timestamp/replay window, event id and payment state; acknowledge only after durable recording.
3. Use transactional outbox and idempotent consumers for critical financial events.
4. Outgoing: sign payloads, protect against SSRF/private-network targets, allow secret rotation and per-tenant quotas.
5. Implement retries with exponential backoff, dead-letter handling and operator replay with audit trail.
6. Track provider statuses; never label manual WhatsApp opening or email preparation as delivery.
7. Test duplicates, reordering, replay, timeouts, recovery, poisoned jobs and tenant isolation.

## Completion
Provide event contracts, dataflow, tests and observable failure states. No real messages, secrets or external actions without authorization.
