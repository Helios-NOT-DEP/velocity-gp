# ADR-0003: Define the realtime event contract before choosing transport mechanics

**Date**: 2026-04-07  
**Status**: accepted  
**Deciders**: Velocity GP maintainers  
**Backlog**: #50  
**Detailed reference**: [Realtime Event Contract](../architecture/realtime-event-contract.md)

## Context

Multiple backlog items depend on live race updates, including player state, admin operations, venue displays, and automation flows. Before choosing fanout infrastructure or reconnect mechanics, the system needs agreement on event types, payload shapes, audience boundaries, and delivery semantics so downstream work can implement against a stable contract.

Issue #50 already defines the canonical event envelope and explicitly defers transport choices to #49. This ADR backfills that contract-first decision into the ADR log.

## Decision

Velocity GP defines one typed realtime event contract before implementing transport. The contract includes a shared envelope, audience-scoped channel policy, per-stream ordering semantics, and at-least-once delivery with idempotency via `idempotencyKey`.

## Alternatives Considered

### Alternative 1: Choose transport infrastructure first and let the contract emerge from implementation
- **Pros**: Can accelerate early delivery for one consumer path.
- **Cons**: Couples event design to transport details; increases the risk of incompatible payloads across player, admin, display, and automation consumers.
- **Why not**: The backlog depends on a reusable event surface, and the repo already treats #50 as the contract baseline for #49.

### Alternative 2: Define separate event shapes for each audience
- **Pros**: Each client receives only data tailored to its own needs.
- **Cons**: Duplicates domain event logic; makes fanout, testing, and schema evolution harder.
- **Why not**: The chosen approach keeps one canonical event catalog with server-side audience filtering.

### Alternative 3: Require total ordering across all events
- **Pros**: Easier mental model for some consumers.
- **Cons**: Adds coordination cost and does not match the natural independence of event-scoped and team-scoped updates.
- **Why not**: The contract intentionally guarantees ordering only within a `streamKey`, which is sufficient and more scalable.

## Consequences

### Positive
- Transport work can proceed against a stable envelope and payload union.
- Different consumers share one event catalog while still subscribing through audience-specific channels.
- Replay, dedupe, and retry behavior are explicit before runtime implementation starts.

### Negative
- Transport implementation must honor the contract rather than shape it opportunistically.
- Consumers need to understand partial ordering by `streamKey` instead of assuming one global sequence.

### Risks
- A future transport may not map cleanly to the contract if it ignores stream semantics; mitigate by treating the contract as the non-negotiable input to #49.
- Event payloads may expand without version discipline; mitigate by keeping contract changes explicit and versioned through shared schema updates.