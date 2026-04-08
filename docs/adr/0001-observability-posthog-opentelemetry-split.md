# ADR-0001: Separate product analytics from technical telemetry

**Date**: 2026-04-07  
**Status**: accepted  
**Deciders**: Velocity GP maintainers  
**Backlog**: #42  
**Detailed reference**: [Observability Plan](../architecture/observability.md)

## Context

Velocity GP needs observability from the start, but the backlog identifies two very different needs: measuring player and organizer behavior, and measuring technical health. Product analytics must support funnel analysis, gameplay adoption, and persona usage. Technical telemetry must support latency tracking, runtime failures, downstream dependency visibility, and future alerts.

The existing observability plan already treats these concerns separately and requires application code to call a shared observability service rather than importing vendor SDKs directly. This ADR backfills that decision from the documented plan in #42.

## Decision

Velocity GP uses PostHog for product analytics and OpenTelemetry for technical telemetry. Application code integrates through a shared observability service layer so product-facing modules do not couple directly to either vendor SDK.

## Alternatives Considered

### Alternative 1: Use a single vendor surface for both analytics and telemetry
- **Pros**: Fewer tools to configure; one place to inspect data.
- **Cons**: Blurs product events with operational signals; makes dashboards and alerting harder to reason about.
- **Why not**: The backlog explicitly separates business insight from technical health, and mixing them would create noisy, less stable instrumentation.

### Alternative 2: Allow feature code to import vendor SDKs directly
- **Pros**: Faster initial implementation for individual features.
- **Cons**: Spreads provider-specific behavior throughout the app; makes later provider changes and event catalog reviews harder.
- **Why not**: The repo already prefers thin service boundaries for integrations, and direct SDK usage would violate that pattern.

## Consequences

### Positive
- Product analytics events can stay business-oriented and stable for dashboards.
- Technical traces and spans can evolve for operational needs without polluting product analytics.
- Future provider changes remain localized to the observability service layer.

### Negative
- The team must maintain two observability surfaces instead of one.
- Developers need discipline to classify signals correctly as either analytics or telemetry.

### Risks
- Engineers may still add ad hoc vendor calls in feature code; mitigate by reviewing new observability work through the shared service layer.
- Event and span catalogs may drift over time; mitigate by keeping the documented catalog in `docs/architecture/observability.md` reviewable and current.