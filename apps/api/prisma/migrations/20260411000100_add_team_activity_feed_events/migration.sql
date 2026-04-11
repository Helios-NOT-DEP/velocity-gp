-- CreateEnum
CREATE TYPE "TeamActivityType" AS ENUM ('PLAYER_ONBOARDING_COMPLETED', 'PLAYER_QR_SCAN');

-- CreateTable
CREATE TABLE "TeamActivityEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "qrCodeId" TEXT,
    "type" "TeamActivityType" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "scanOutcome" "ScanOutcome",
    "pointsAwarded" INTEGER,
    "errorCode" TEXT,
    "qrCodeLabel" TEXT,
    "qrPayload" TEXT,
    "summary" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamActivityEvent_eventId_sourceKey_key" ON "TeamActivityEvent"("eventId", "sourceKey");

-- CreateIndex
CREATE INDEX "TeamActivityEvent_eventId_teamId_occurredAt_idx" ON "TeamActivityEvent"("eventId", "teamId", "occurredAt");

-- CreateIndex
CREATE INDEX "TeamActivityEvent_teamId_occurredAt_idx" ON "TeamActivityEvent"("teamId", "occurredAt");

-- CreateIndex
CREATE INDEX "TeamActivityEvent_playerId_occurredAt_idx" ON "TeamActivityEvent"("playerId", "occurredAt");

-- AddForeignKey
ALTER TABLE "TeamActivityEvent" ADD CONSTRAINT "TeamActivityEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamActivityEvent" ADD CONSTRAINT "TeamActivityEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamActivityEvent" ADD CONSTRAINT "TeamActivityEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamActivityEvent" ADD CONSTRAINT "TeamActivityEvent_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QRCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
