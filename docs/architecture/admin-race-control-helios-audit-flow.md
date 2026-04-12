# Admin Race Control, Helios Role, and Audit Flow

## Purpose

Define the runtime contract for organizer-sensitive controls in issue #26:

- global race pause/resume
- Helios role assignment/revocation
- admin audit visibility for sensitive actions

This document captures the current implemented behavior in API and admin web surfaces.

## API Surface

Admin controls are exposed under `/api/admin`:

- `GET /admin/events/:eventId/race-control` — read current race-control state (`ACTIVE` or `PAUSED`)
- `POST /admin/events/:eventId/race-control` — update race-control state; writes admin audit row
- `POST /admin/users/:userId/helios-role` — assign/revoke Helios role for a user; writes admin audit row
- `GET /admin/events/:eventId/audits` — list event-scoped admin audit entries (cursor + limit)

Related roster payloads now include `isHelios` on each admin roster row so the admin Players table can render role state and action controls.

## Race Control Semantics

- Race control is stored in `EventConfig.raceControlState`.
- When paused, scan processing is blocked server-side with `outcome=BLOCKED` and `errorCode=RACE_PAUSED`.
- UI state is hydrated from `GET /admin/events/:eventId/race-control` and updated optimistically only after mutation success.
- Pause/resume mutations return `auditId` and `updatedAt` for immediate audit/UI refresh.

## Helios Assignment Semantics

- Helios mutation toggles `User.isHelios` and normalizes `User.role`:
  - assign -> `isHelios=true`, role escalates to `HELIOS`
  - revoke -> `isHelios=false`, role de-escalates to `PLAYER` when applicable
- Audit rows for Helios actions are anchored to the active event context to ensure they appear in event-scoped admin audit feeds.

## Audit Trail Contract

Sensitive actions write `AdminActionAudit` rows and are queryable through `GET /admin/events/:eventId/audits`.

Primary action types covered in #26:

- `RACE_PAUSED`
- `RACE_RESUMED`
- `HELIOS_ASSIGNED`
- `HELIOS_REVOKED`

The admin Game Control screen renders recent entries (actor, action, target, timestamp) and refreshes after relevant mutations.

## Web Admin Behavior

### Game Control

- Reads current race-control status on page load.
- Primary button toggles pause/resume and updates scanner availability messaging.
- Displays a recent admin audit panel sourced from event-scoped audit entries.

### Players

- Displays per-row Helios role status from roster data.
- Supports assign/revoke Helios actions with per-row pending state and error handling.
- Refreshes roster and latest audit summary after role changes.

## Out of Scope

- Reset-all-scores workflow remains tracked separately from #26.
- This artifact does not define transport/push mechanics; it covers API + admin UI contract behavior only.
