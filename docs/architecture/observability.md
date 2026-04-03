# Observability Plan

Issue: `#42 - [Foundation] Establish observability with PostHog and OpenTelemetry`

## Responsibilities

- **PostHog** owns product analytics: page views, player funnel steps, feature usage, and persona adoption.
- **OpenTelemetry** owns technical telemetry: API traces, backend spans, runtime failures, and the metrics/alerts that will be derived from them.
- Product code calls the shared observability service instead of importing vendor SDKs directly.

## Core Product Events

| Event | Why it matters | Owner |
|-------|----------------|-------|
| `page_viewed` | Screen usage and funnel drop-off | PostHog |
| `auth_login_submitted` | Entry into the player login flow | PostHog |
| `team_created` | Garage completion and team activation | PostHog |
| `helios_role_enabled` | Helios persona engagement | PostHog |
| `qr_scan_recorded` | Core gameplay loop usage and point velocity | PostHog |
| `pit_stop_started` | Hazard pressure and team interruption moments | PostHog |
| `pit_stop_cleared` | Recovery and flow completion | PostHog |

## Core Telemetry Spans

| Span | Why it matters | Owner |
|------|----------------|-------|
| `api.request` | Request latency, status, and downstream dependency health | OpenTelemetry |
| `ui.error` | Frontend runtime failures and broken user journeys | OpenTelemetry |

## Instrumentation Rules

- Keep analytics events business-oriented and stable enough for dashboards.
- Keep telemetry attributes operational and implementation-oriented.
- Do not send backend timing or error volume into product analytics.
- Do not couple page components to PostHog or OpenTelemetry SDKs directly.
- Prefer adding new events via `apps/web/src/services/observability/events.ts` so the catalog stays reviewable.

## Future Backend Adoption

When server endpoints are introduced, they should:

1. Reuse the same span naming strategy for inbound requests and downstream calls.
2. Attach event context like `event.id`, `team.id`, and `player.id` as trace attributes where appropriate.
3. Export traces and metrics through an OpenTelemetry SDK/collector without requiring product code changes.
4. Build alerting on latency, error rate, and failed gameplay operations rather than on UI analytics.
