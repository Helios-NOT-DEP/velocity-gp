# Realtime Event Contract (Issue #50)

This document defines the typed event contract that downstream runtime transport work in Issue #49 must implement.

ADR reference: [ADR-0003](../adr/0003-realtime-event-contract-before-transport.md)

## Purpose

- Establish one canonical envelope for live race events.
- Define event payload shapes and audience channel boundaries.
- Lock ordering and idempotency semantics before transport implementation.

## Event Envelope

Every realtime event uses the same envelope:

- `id`: globally unique event identifier.
- `type`: one of the contract event types.
- `version`: contract version (`1`).
- `occurredAt`: ISO timestamp for when the domain event happened.
- `eventId`: race event scope.
- `streamKey`: ordering shard key.
- `streamSequence`: monotonic sequence per stream key.
- `idempotencyKey`: dedupe key for at-least-once delivery.
- `payload`: event-type-specific payload.

## Event Catalog

- `SCAN_SUCCESS`
  - Trigger source: successful scan settlement.
  - Minimal payload: safe scan result (`outcome=SAFE`) with awarded points and team score.
- `HAZARD_HIT`
  - Trigger source: hazard modulo trigger during scan settlement.
  - Minimal payload: hazard scan result (`outcome=HAZARD_PIT`) with pit expiry.
- `PIT_RELEASED`
  - Trigger source: pit release paths (timer expiry, rescue clear, manual admin clear).
  - Minimal payload: `teamId`, `releasedAt`, `reason`, resulting active state.
- `RESCUE_UPDATED`
  - Trigger source: rescue lifecycle transitions.
  - Minimal payload: rescue identifiers, status, rescuer, timestamps.
- `RACE_CONTROL_UPDATED`
  - Trigger source: admin race pause/resume update.
  - Minimal payload: updated race-control state and audit identifier.
- `LEADERBOARD_CHANGED`
  - Trigger source: score/ranking changes.
  - Minimal payload: updated leaderboard entries, trigger reason, timestamp.

## Ordering and Stream Semantics

- Ordering is guaranteed only within a `streamKey`.
- No total ordering is guaranteed across different stream keys.
- Default stream key strategies:
  - Event-scoped: `event:{eventId}`
  - Team-scoped: `event:{eventId}:team:{teamId}`
- Consumers must process events in-order per stream key and treat cross-stream interleaving as expected.

## Idempotency and Replay

- Delivery contract is at-least-once.
- Consumers must dedupe on `idempotencyKey`.
- Replay/backfill may resend previously seen events with the same `idempotencyKey`.
- Producers should set `idempotencyKey` explicitly when retries or replay can generate a new `id`.

## Audience Channels

The contract defines audience-scoped channels:

- `player`: `SCAN_SUCCESS`, `HAZARD_HIT`, `PIT_RELEASED`, `RESCUE_UPDATED`, `RACE_CONTROL_UPDATED`
- `admin`: all core event types
- `display`: `LEADERBOARD_CHANGED`, `HAZARD_HIT`, `PIT_RELEASED`, `RESCUE_UPDATED`
- `automation`: all core event types

This channel matrix is encoded in typed contract policy for server-side filtering.

## Out of Scope (Issue #50)

- Runtime transport implementation (WebSocket/webhook/SSE fanout).
- Reconnect API design and resume tokens.
- Persistence/replay backend design.

Those implementation details are intentionally deferred to Issue #49.

## Current Runtime Behavior (Until Issue #49)

- The event contract is the canonical schema, but fanout transport is not yet the primary client sync path.
- Pit-stop lockout/release UX currently relies on backend-authoritative API state (`teamStatus`, `pitStopExpiresAt`) with periodic client refresh.
- Any eventual transport implementation must preserve this contract envelope, ordering semantics, and idempotency guarantees.
