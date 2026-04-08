# ADR-0002: Use `workEmail` as canonical identity and centralize assignment-based routing

**Date**: 2026-04-07  
**Status**: accepted  
**Deciders**: Velocity GP maintainers  
**Backlog**: #44  
**Detailed reference**: [Assignment and Identity Rulebook](../architecture/assignment-identity-rulebook.md)

## Context

Velocity GP's player authentication and post-login routing depend on a stable way to identify attendees across roster imports, admin assignment workflows, and event-day sign-in. The backlog also requires deterministic behavior for assigned, pending, and unassigned players, while avoiding user enumeration in magic-link flows.

The rulebook in #44 is already written as the canonical baseline for #12 and #14 and describes implemented behavior from #43 and #45. This ADR backfills that stable rulebook into a concise architectural decision record.

## Decision

Velocity GP uses normalized `workEmail` as the canonical attendee identity key. Assignment state is derived from `Player.teamId` plus `Team.status`, and post-auth routing is centralized around that derived state instead of being distributed across page-level components.

## Alternatives Considered

### Alternative 1: Use multiple identity keys such as phone number and email equally
- **Pros**: More flexible matching options for roster data.
- **Cons**: Increases duplicate identity risk; complicates import dedupe, auth eligibility, and admin override behavior.
- **Why not**: The backlog needs one authoritative key for roster upserts and auth eligibility, and the rulebook explicitly treats `phoneE164` as metadata rather than identity.

### Alternative 2: Store assignment flags directly in auth or session logic
- **Pros**: Can simplify some route checks in the short term.
- **Cons**: Duplicates roster state in more than one place; risks drift between roster operations and auth decisions.
- **Why not**: The repo already defines assignment as derived domain state from player membership and team status.

### Alternative 3: Let each page decide how to handle player state
- **Pros**: Quick to implement within individual screens.
- **Cons**: Produces inconsistent redirects and leaks auth-state branching into route components.
- **Why not**: The backlog explicitly requires centralized and deterministic routing behavior.

## Consequences

### Positive
- Roster import, auth eligibility, and player routing all share one identity model.
- Assignment behavior remains auditable and admin-controlled.
- Page components can rely on a single routing contract instead of duplicating auth-state logic.

### Negative
- Supporting personal email or alternative identifiers later will require explicit extension work.
- The auth flow must reject unassigned users even when identity lookup succeeds.

### Risks
- Future features may try to overload `phoneE164` or personal email as identity; mitigate by preserving `workEmail` as canonical unless a new ADR supersedes this one.
- Teams may accidentally bypass centralized route logic; mitigate by keeping the route matrix in one shared implementation path and reviewing page-level auth logic changes.