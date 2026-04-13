# Admin QR Inventory Flow

## Purpose

Define the runtime contract for admin-managed QR inventory operations, including single-code generation, image asset generation through n8n, and soft-delete behavior.

## API Surface

The admin QR workflow is exposed under `/api/admin/events/:eventId/qr-codes`:

- `GET /admin/events/:eventId/qr-codes` — list active inventory rows (soft-deleted rows excluded)
- `POST /admin/events/:eventId/qr-codes` — create a QR row with `label`, `value`, `zone`, and activation window fields
- `PATCH /admin/events/:eventId/qr-codes/:qrCodeId/status` — toggle `ACTIVE`/`DISABLED`
- `DELETE /admin/events/:eventId/qr-codes/:qrCodeId` — soft-delete row (`deletedAt` set)

Each mutation writes an admin audit row (`QR_CREATED`, `QR_STATUS_UPDATED`, `QR_DELETED`).

## n8n QR Asset Generation

Creation uses `N8N_HOST + N8N_QRCODEGEN_WEBHOOK_PATH_TEMPLATE`.

Default template:

- `N8N_QRCODEGEN_WEBHOOK_PATH_TEMPLATE=/webhook/{env}/QRCodeGen`

Runtime expansion:

- `NODE_ENV=development|test` -> `/webhook/dev/QRCodeGen`
- `NODE_ENV=production` -> `/webhook/prod/QRCodeGen`

Request body sent by the API service:

```json
{
  "id": "<qrCodeId>",
  "url": "https://<trusted-origin>/scan/<payload>"
}
```

Response contract expected from n8n:

```json
{
  "id": "<qrCodeId>",
  "url": "https://<trusted-origin>/scan/<payload>",
  "qrImageURL": "https://<cdn-url>/..."
}
```

The API persists `qrImageURL` into `QRCode.qrImageUrl` for admin preview/download.

## Scanner Compatibility

Generated QR codes encode trusted URLs in `/scan/<payload>` form. The web scanner resolves this trusted path back to gameplay payload submission without browser navigation. Other trusted-origin URLs retain redirect behavior.

## Soft Delete Rules

- Deleting a QR code sets `deletedAt` and forces status to `DISABLED`.
- Deleted rows are excluded from admin inventory listing and scan-time payload lookup.
- Historical data (claims, scans, audits) remains intact for event forensics.

## Helios Superpower QR — Separate Flow

The `SuperpowerQRAsset` model is **not** part of the admin QR inventory. It is an identity-bound, account-scoped asset with its own lifecycle:

- Managed by `superpowerQrService.ts`, not `adminQrCodeService.ts`.
- Exposed under `GET /players/:playerId/superpower-qr` and `POST /players/:playerId/superpower-qr/regenerate`.
- Guarded by `requireHelios` middleware; only the owning Helios user or an admin may access it.
- Payloads use the `VG-SP-{entropy}` prefix (distinct from event QR `VG-{entropy}` payloads).
- Provisioned automatically on first access — no admin setup required.
- Safe regeneration: new asset is generated before the old one is revoked.

See [ADR-0007](../adr/0007-helios-superpower-qr-generation.md) for the full rationale.
