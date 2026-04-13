-- Enforce one ACTIVE Superpower QR asset per user while allowing unlimited REVOKED history.
CREATE UNIQUE INDEX "SuperpowerQRAsset_userId_active_unique"
ON "SuperpowerQRAsset"("userId")
WHERE "status" = 'ACTIVE';
