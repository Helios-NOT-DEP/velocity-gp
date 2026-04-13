# ADR-0007: Helios Superpower QR — identity-bound persistent asset

**Date**: 2026-04-13  
**Status**: accepted  
**Deciders**: Velocity GP maintainers  
**Backlog**: #21  
**Detailed reference**: [Admin QR Inventory Flow](../architecture/admin-qr-inventory-flow.md)

## Context

Helios users need a personal, durable QR code that links directly to their user identity rather than to a game event or inventory slot. When another player scans it, the Helios rescue flow is initiated. Key requirements:

- The QR must be bound to the Helios user for the lifetime of their account.
- Helios users must be able to replace (regenerate) their QR without a gap window where no valid code exists.
- Non-Helios users must be blocked at every layer.
- The code must survive event boundaries (not per-event inventory).

The existing `QRCode` model is event-scoped and admin-managed. It does not meet the identity-bound, self-service requirements for the Helios Superpower QR.

## Decision

Velocity GP introduces a dedicated `SuperpowerQRAsset` model and lifecycle separate from the admin QR inventory:

1. **Separate Prisma model** (`SuperpowerQRAsset`) with an explicit `status` enum (`ACTIVE | REVOKED`) and `userId` foreign key — not `eventId`.
2. **On-demand provisioning** — `getActiveSuperpowerQR(userId)` auto-provisions a new asset on first access. Helios users never need an explicit setup step.
3. **Safe regeneration order** — `regenerateSuperpowerQR` generates and persists the new asset *first* (so a webhook failure leaves the old asset intact), then revokes the old one. No window where the user has zero valid QR codes.
4. **Distinct payload format** — `VG-SP-{12-char entropy}` distinguishes Superpower payloads from event QR payloads (`VG-{entropy}`) at the scanner level.
5. **Same n8n webhook** — reuses the `generateQrAsset` pattern with `x-velocity-event: SUPERPOWER_QR_GENERATE` header for routing inside n8n.
6. **Ownership enforced at the route layer** — only the Helios user that owns the asset or an admin may access it. `requireHelios` middleware gates the endpoints; a second ownership check throws `ForbiddenError` for cross-user access.

## Alternatives Considered

### Alternative 1: Reuse the existing `QRCode` / admin inventory model
- **Pros**: No new table; admin tooling already exists.
- **Cons**: `QRCode` is event-scoped and requires an `eventId`. Helios identity QRs are account-scoped. Shoehorning them into inventory would break the event FK constraint and corrupt admin inventory listings.
- **Why not**: The domain semantics are fundamentally different.

### Alternative 2: Invalidate old asset before generating the new one
- **Pros**: Simpler transaction — one record at a time.
- **Cons**: Any failure between revoke and new asset creation leaves the Helios user with no valid QR code during that window, which breaks the rescue flow on event day.
- **Why not**: "New first, then revoke" is the safer ordering with no downtime for the user.

### Alternative 3: Admin-only regeneration flow
- **Pros**: Reduces self-service surface.
- **Cons**: Blocks Helios users from replacing a compromised or leaked QR without operator intervention. Operationally unworkable on event day.
- **Why not**: Self-service regeneration is a documented acceptance criterion (#21).

### Alternative 4: Encode the identity payload as a redirect URL (like event QR codes)
- **Pros**: Consistent with existing trusted-URL scan flow.
- **Cons**: The Superpower payload triggers a distinct server-side identity rescue path, not a redirect. The payload constant (`VG-SP-*`) is simpler and avoids embedding long URLs in QR images, improving scan reliability.
- **Why not**: The scanner already resolves payload prefixes; adding a new prefix is lower complexity.

## Consequences

### Positive
- Helios identity QR lifecycle is fully decoupled from event QR inventory, with no risk of accidental deletion or bulk event operations touching personal assets.
- Provisioning on first access means zero admin setup required to get a Helios user a QR.
- Safe regeneration order prevents any rescue gap window.
- Distinct `VG-SP-*` prefix makes scanner routing unambiguous.

### Neutral
- A new Prisma model and migration are required (`SuperpowerQRAsset`, `SuperpowerQRAssetStatus` enum).
- A new `AdminActionType` enum value (`SUPERPOWER_QR_REGENERATED`) is added for future audit coverage.
- `requireHelios` middleware is new but minimal (10 lines); it follows the same pattern as `requireAdmin` and `requirePlayer`.

### Negative / Watch
- n8n webhook reuse means the same external dependency handles both flows. If n8n is unavailable, provisioning and regeneration fail. This is acceptable given n8n's role as the QR generation backbone across the whole system.
- The `SuperpowerQRAsset` table grows indefinitely as revoked rows accumulate. A pruning strategy for old revoked rows should be added in a follow-up housekeeping task.
