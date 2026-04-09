# ADR-0004: Replace SendGrid with n8n + Mailtrap for transactional email

**Date:** 2026-04-08  
**Status:** Accepted  
**Deciders:** Engineering

---

## Context

Velocity GP used SendGrid as the outbound email provider for magic-link login delivery. The integration was a direct HTTP call from `authService.ts` to the SendGrid v3 API, keyed by `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL`.

This meant:
- Email sending logic was embedded directly in the auth service.
- HTML templates existed only in `docs/email templates/` and were unused — emails were sent as plain-text.
- Provider swap, retries, and template management required API code changes.
- n8n was already planned for orchestration (DigitalOcean Droplet) but unused in the email path.
- Mailtrap was already integrated for inbound event ingestion (bounces, delivery events) via `POST /api/webhooks/mailtrap/events`, with `EmailEvent` persistence, but not for outbound.

## Decision

**Replace the direct SendGrid outbound call with an indirect call through an n8n workflow named `email`**, which handles template selection and dispatches via Mailtrap's transactional email API.

Concretely:

1. **New `emailDispatchService`** — thin webhook sender that `POST`s a structured payload to the n8n `email` workflow trigger URL over HTTPS with a short-lived HS512 JWT in the Bearer header, correlation ID, and `x-velocity-event: EMAIL_DISPATCH` header. Falls back to a no-op if n8n is unconfigured (preserves CI and dev behavior).

2. **n8n `email` workflow** — receives the payload (`templateKey`, `toEmail`, `variables`, `correlationId`), looks up the Mailtrap template by key, merges variables, and sends via the Mailtrap API. n8n owns all retry and fallback logic.

3. **Mailtrap-managed templates** — four dark-themed templates created via MCP:
   - `magic_link_login` (ID 64344)
   - `welcome_onboarding` (ID 64343)
   - `race_reminder` (ID 64342)
   - `admin_alert` (ID 64345)

4. **SendGrid removed** — `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` env vars removed; all SendGrid call paths deleted.

5. **Inbound Mailtrap webhook hardened** — `POST /api/webhooks/mailtrap/events` now accepts HMAC-signed requests using `x-mailtrap-signature` + `x-mailtrap-timestamp` with `MAILTRAP_WEBHOOK_SECRET`, while temporarily retaining legacy bearer-token fallback (`N8N_WEBHOOK_TOKEN`) during migration.

## Consequences

**Positive**
- Email presentation (HTML, copy, variables) is owned by Mailtrap templates and managed outside the codebase — no redeploy needed for email content changes.
- n8n owns retry logic, rate limiting, and provider fallback — the API is a fire-and-forget publisher.
- Provider swaps in future (Postmark, SES, etc.) require n8n wiring only; the API contract (`templateKey` + variables) is stable.
- Correlation IDs allow cross-system tracing between API dispatch, n8n execution, and Mailtrap delivery events.
- The test seam (`setEmailDispatcherForTests`) cleanly replaces the old `setMagicLinkEmailSenderForTests` pattern with a type-safe interface.

**Negative / trade-offs**
- Email delivery now has an extra hop (API → n8n → Mailtrap), increasing latency and introducing a second failure surface.
- If the n8n `email` workflow is misconfigured or the Droplet is down, emails are dropped silently (same as the old no-config graceful degradation behavior). Alerting on `email.dispatch.failure` counter is required to catch this.
- Template variable contracts live in two places: the n8n workflow and the call sites in `emailDispatchService`/`authService`. Drift must be caught by integration smoke tests.

## Alternatives considered

- **Keep SendGrid, add HTML templates** — simpler, but leaves provider coupling in the API and doesn't leverage the n8n infrastructure already planned.
- **Call Mailtrap directly from API** — removes the n8n hop, but couples the API to a specific email provider and duplicates retry logic already solved by n8n.
- **Feature-flagged rollout** — considered but rejected in favour of a hard cutover to keep the codebase clean and avoid dual-path complexity.

## References

- `apps/api/src/services/emailDispatchService.ts` — new dispatch abstraction
- `apps/api/src/services/authService.ts` — magic-link wiring
- `apps/api/src/config/env.ts` — `N8N_HOST`, `N8N_WEBHOOK_TOKEN`, `N8N_WEBHOOK_TIMEOUT_MS`, `MAILTRAP_WEBHOOK_SECRET`
- `apps/api/src/routes/emailWebhook.ts` — inbound Mailtrap events with signature auth
- Mailtrap template IDs: 64344, 64343, 64342, 64345
