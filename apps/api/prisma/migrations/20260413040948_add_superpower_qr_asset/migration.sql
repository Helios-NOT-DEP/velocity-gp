-- CreateEnum
CREATE TYPE "SuperpowerQRAssetStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterEnum
ALTER TYPE "AdminActionType" ADD VALUE 'SUPERPOWER_QR_REGENERATED';

-- CreateTable
CREATE TABLE "SuperpowerQRAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "qrImageUrl" TEXT NOT NULL,
    "status" "SuperpowerQRAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "regeneratedAt" TIMESTAMP(3),

    CONSTRAINT "SuperpowerQRAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuperpowerQRAsset_payload_key" ON "SuperpowerQRAsset"("payload");

-- CreateIndex
CREATE INDEX "SuperpowerQRAsset_userId_status_idx" ON "SuperpowerQRAsset"("userId", "status");

-- CreateIndex
CREATE INDEX "SuperpowerQRAsset_userId_createdAt_idx" ON "SuperpowerQRAsset"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "SuperpowerQRAsset" ADD CONSTRAINT "SuperpowerQRAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
