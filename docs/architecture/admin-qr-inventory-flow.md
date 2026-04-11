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

Creation uses the n8n webhook path:

- `https://n8n.velocitygp.app/webhook/{dev|prod}/QRCodeGen`

`{dev|prod}` is selected from runtime environment (`NODE_ENV=production` -> `prod`, otherwise `dev`).

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
