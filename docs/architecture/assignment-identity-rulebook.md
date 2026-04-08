# Assignment and Identity Rulebook (Issue #44)

This document is the canonical spec for attendee identity, team assignment state, and post-auth routing.
It reflects implemented behavior from #43 and #45 and is the contract baseline for #12 and #14.

ADR reference: [ADR-0002](../adr/0002-work-email-identity-and-assignment-routing.md)

## Scope

- This is a specification-only artifact.
- It does not introduce runtime, schema, or API mutations.
- It documents current intended behavior for backend and web implementations.

## Canonical Identity Rules

### Identity key

- Canonical attendee identity key is normalized `workEmail` (`trim().toLowerCase()`).
- `workEmail` maps to `User.email` and is the only matching key used for roster upsert and auth eligibility checks.

### Contact metadata

- `phoneE164` is optional contact metadata on `User`.
- `phoneE164` is not used as an identity key and must not drive user matching.

### Duplicate-prevention expectations

- Identity-level dedupe is enforced by unique `User.email`.
- Event-membership dedupe is enforced by unique `[eventId, userId]` on `Player`.
- Import payload-level duplicates are detected by normalized `workEmail`; affected rows are marked invalid.

## Assignment State Contract

Assignment state must be derived from `Player.teamId` and `Team.status` as follows:

- `UNASSIGNED`: `player.teamId` is `null`.
- `ASSIGNED_PENDING`: `player.teamId` is set and `team.status` is `PENDING`.
- `ASSIGNED_ACTIVE`: `player.teamId` is set and `team.status` is `ACTIVE` or `IN_PIT`.

This mapping is the source of truth for auth gating and redirect decisions.

## Admin Roster Rules

All roster operations are event-scoped and admin-guarded under `/admin/events/:eventId/roster`.

### Assignment update semantics

- `PATCH /roster/players/:playerId/assignment` supports assign, reassign, and unassign (`teamId: null`).
- Team target must belong to the same event.
- No-op updates return successfully and do not create audit rows.

### Import preview semantics

- Preview validates rows and returns row-level outcomes without mutating state.
- Validation includes:
  - required `workEmail` and `displayName`
  - optional phone format checks (E.164)
  - duplicate `workEmail` within payload
- Action classification includes `create`, `update`, `assign`, `reassign`, `unchanged`, `invalid`.

### Import apply semantics

- Apply processes only valid rows.
- Merge strategy is upsert-by-email plus event-scoped player membership sync.
- Existing assignment is preserved unless the row explicitly provides a team assignment.
- Unknown `teamName` may be auto-created in the same event.

### Required admin audits

Roster workflows must produce auditable actions:

- `ROSTER_IMPORTED`
- `ROSTER_ASSIGNED`
- `ROSTER_REASSIGNED`
- `ROSTER_UNASSIGNED`

## Auth and Routing Alignment

### Magic-link request

- Request contract accepts `workEmail` only.
- Response must be non-enumerating:
  - eligible and ineligible emails receive the same accepted-style response shape and generic message.

### Verify/session gating

- Magic-link verify requires a valid token and eligible event/player mapping.
- Unassigned players are rejected with `AUTH_ASSIGNMENT_REQUIRED`.
- Session fetch enforces the same assignment requirement.

### Deterministic routing matrix

| Assignment state | Route |
| --- | --- |
| `UNASSIGNED` | `/waiting-assignment` |
| `ASSIGNED_PENDING` | `/garage` |
| `ASSIGNED_ACTIVE` | `/race-hub` |

Unauthorized or expired sessions redirect to login.

## Error and Override Matrix

| Scenario | Expected response |
| --- | --- |
| Missing/invalid admin auth on roster endpoints | `401 UNAUTHORIZED` or `403 FORBIDDEN` |
| Assignment target team not in event | `400 VALIDATION_ERROR` |
| Assignment target player not in event | `400 VALIDATION_ERROR` |
| Magic-link verify invalid/expired | `401 AUTH_INVALID_LINK` |
| Magic-link verify unassigned | `403 AUTH_ASSIGNMENT_REQUIRED` |
| Session token missing | `401 AUTH_MISSING_TOKEN` |
| Session token invalid/expired | `401 AUTH_INVALID_SESSION` |

Admin override is explicit and auditable:

- Manual assignment changes are allowed only through admin routes.
- Manual and import-driven assignment overrides must write roster audit rows.

## Future Extension (Out of Scope in #44)

Personal email support is a future extension and not part of current identity matching.
If introduced later:

- `workEmail` must remain canonical for event-day auth and assignment eligibility.
- Personal-email support must define conflict and verification rules that cannot overwrite canonical `workEmail` identity binding without explicit admin action.
- Backfill/migration policy must preserve existing `User.email` uniqueness and event membership integrity.
