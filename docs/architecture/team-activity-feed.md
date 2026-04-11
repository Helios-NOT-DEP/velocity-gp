# Team Activity Feed

Backlog: #86, #87

This document defines the backend read model and API used to power the Race Hub "Recent Activity" feed for a player's current team.

## Purpose

- Provide a running feed of team events relevant during gameplay.
- Capture onboarding completion and QR scan outcomes in a consistent shape.
- Support near-realtime UI refresh using polling until transport-level push is reintroduced.

## Event Types

- `PLAYER_ONBOARDING_COMPLETED`
  - Emitted once per `(eventId, playerId, teamId)` when a player verifies into an `ASSIGNED_ACTIVE` session.
  - Idempotency key format: `onboarding_completed:{playerId}:team:{teamId}`.
- `PLAYER_QR_SCAN`
  - Emitted for every scan settlement outcome (`SAFE`, `HAZARD_PIT`, `INVALID`, `DUPLICATE`, `BLOCKED`).
  - Includes QR identity (`qrCodeId`, `qrCodeLabel`, `qrPayload`) and outcome metadata (`pointsAwarded`, `errorCode`).
  - Idempotency key format: `scan:{scanRecordId}`.

## Persistence Model

Data is stored in `TeamActivityEvent` with:

- Scope keys: `eventId`, `teamId`, `playerId`
- Ordering field: `occurredAt`
- Type discriminator: `type`
- Scan metadata fields for QR outcome rendering
- Human-readable `summary` for direct UI use
- Composite uniqueness on `(eventId, sourceKey)` for idempotent inserts

## API Surface

- `GET /events/:eventId/teams/:teamId/activity-feed?limit=25`
- Response shape: `ListTeamActivityFeedResponse`
- Auth boundary:
  - Session `eventId` must match route `eventId`
  - Session `teamId` must match route `teamId`

## Delivery Strategy

- Race Hub polls every 5 seconds and also refreshes immediately after successful scan submission.
- Polling is the v1 transport choice to reduce rollout risk while preserving a stable feed contract.
- Feed entries are ordered descending by `occurredAt` then `createdAt`.

## Relationship to Realtime Contract

- This feed is a persisted, team-scoped read model optimized for Race Hub UX.
- It does not replace the canonical realtime event contract in `realtime-event-contract.md`.
- Future push transport can map to this feed model, but the feed remains a durable audit-friendly source for recent team activity.
