# ADR-0006: Persist a team activity feed read model for Race Hub

**Date**: 2026-04-11  
**Status**: accepted  
**Deciders**: Velocity GP maintainers  
**Backlog**: #86, #87  
**Detailed reference**: [Team Activity Feed](../architecture/team-activity-feed.md)

## Context

Race Hub needs a running, team-scoped activity feed that shows:

- when a player completes onboarding and becomes race-ready
- scan outcomes including QR identity, hazards, and points

Current local-only scan arrays in web context are not durable, not team-queryable from API, and do not capture onboarding events. Existing realtime transport work is closed, but this UX still needs a persisted source that can be safely polled.

## Decision

Velocity GP persists activity entries in a dedicated `TeamActivityEvent` read model and exposes a team-scoped feed endpoint:

- emit `PLAYER_ONBOARDING_COMPLETED` at active onboarding completion (idempotent)
- emit `PLAYER_QR_SCAN` for each scan settlement result
- serve `GET /events/:eventId/teams/:teamId/activity-feed` for Race Hub polling

The first delivery mode is polling with immediate refresh after scan submit.

## Alternatives Considered

### Alternative 1: Reuse `ScanRecord` only
- **Pros**: No new table
- **Cons**: Cannot represent onboarding events cleanly and requires scattered joins/transform logic in UI
- **Why not**: The feed needs a unified event timeline, not scan-only rows

### Alternative 2: Use in-memory web context only
- **Pros**: Fast to prototype
- **Cons**: Not durable, not authoritative, not cross-device, and not queryable from API
- **Why not**: Event-day feed must be backend-owned and consistent per team

### Alternative 3: Build SSE/WebSocket transport first
- **Pros**: Lower latency updates
- **Cons**: Higher rollout complexity and reconnect/state-resume work before basic feed UX lands
- **Why not**: Polling provides lower-risk delivery while preserving the contract for future push

## Consequences

### Positive
- Team activity feed is durable, idempotent, and backend-authored
- Race Hub gets consistent onboarding and scan event visibility
- Future push transport can layer over an existing read model

### Negative
- Adds new persistence table and read-path maintenance
- Polling introduces predictable background request load

### Risks
- Duplicate onboarding entries if idempotency is misapplied; mitigated by `(eventId, sourceKey)` uniqueness
- Feed lag under polling interval; mitigated by immediate post-scan refresh
