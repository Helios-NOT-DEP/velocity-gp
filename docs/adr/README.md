# Architecture Decision Records

This directory captures the concise architectural decisions that shape Velocity GP.
Detailed implementation and contract references remain in `docs/architecture/`.

| ADR | Title | Status | Date | Backlog |
| --- | ----- | ------ | ---- | ------- |
| [0001](./0001-observability-posthog-opentelemetry-split.md) | Separate product analytics from technical telemetry | accepted | 2026-04-07 | #42 |
| [0002](./0002-work-email-identity-and-assignment-routing.md) | Use `workEmail` as canonical identity and centralize assignment-based routing | accepted | 2026-04-07 | #44 |
| [0003](./0003-realtime-event-contract-before-transport.md) | Define the realtime event contract before choosing transport mechanics | accepted | 2026-04-07 | #50 |