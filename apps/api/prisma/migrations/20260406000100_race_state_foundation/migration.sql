-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'HELIOS', 'PLAYER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('PENDING', 'ACTIVE', 'IN_PIT');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('RACING', 'IN_PIT', 'FINISHED');

-- CreateEnum
CREATE TYPE "RaceControlState" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "QRCodeStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ScanOutcome" AS ENUM ('SAFE', 'HAZARD_PIT', 'INVALID', 'DUPLICATE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RescueStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TeamTransitionReason" AS ENUM ('HAZARD_TRIGGER', 'RESCUE_CLEARED', 'TIMER_EXPIRED', 'ADMIN_MANUAL', 'SYSTEM_RESET');

-- CreateEnum
CREATE TYPE "AdminActionType" AS ENUM ('RACE_PAUSED', 'RACE_RESUMED', 'HELIOS_ASSIGNED', 'HELIOS_REVOKED', 'PIT_MANUAL_ENTER', 'PIT_MANUAL_CLEAR', 'SCORE_RESET');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "isHelios" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'UPCOMING',
    "maxPlayers" INTEGER,
    "currentPlayerCount" INTEGER NOT NULL DEFAULT 0,
    "venueId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventConfig" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "globalHazardRatio" INTEGER NOT NULL DEFAULT 15,
    "pitStopDurationSeconds" INTEGER NOT NULL DEFAULT 900,
    "invalidScanPenalty" INTEGER NOT NULL DEFAULT 1,
    "raceControlState" "RaceControlState" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" "TeamStatus" NOT NULL DEFAULT 'PENDING',
    "pitStopExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT,
    "status" "PlayerStatus" NOT NULL DEFAULT 'RACING',
    "individualScore" INTEGER NOT NULL DEFAULT 0,
    "isFlaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRCode" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "zone" TEXT,
    "payload" TEXT NOT NULL,
    "status" "QRCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "activationStartsAt" TIMESTAMP(3),
    "activationEndsAt" TIMESTAMP(3),
    "hazardRatioOverride" INTEGER,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QRCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRCodeClaim" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QRCodeClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanRecord" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "qrCodeId" TEXT,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT,
    "outcome" "ScanOutcome" NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "hazardRatioUsed" INTEGER,
    "globalScanCountBefore" INTEGER,
    "globalScanCountAfter" INTEGER,
    "scannedPayload" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamStateTransition" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "fromStatus" "TeamStatus",
    "toStatus" "TeamStatus" NOT NULL,
    "reason" "TeamTransitionReason" NOT NULL,
    "triggeredByUserId" TEXT,
    "triggeredByPlayerId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamStateTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActionAudit" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actionType" "AdminActionType" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rescue" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "requestingPlayerId" TEXT NOT NULL,
    "requestingTeamId" TEXT NOT NULL,
    "rescuerUserId" TEXT NOT NULL,
    "status" "RescueStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cooldownExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rescue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EventConfig_eventId_key" ON "EventConfig"("eventId");

-- CreateIndex
CREATE INDEX "Team_eventId_idx" ON "Team"("eventId");

-- CreateIndex
CREATE INDEX "Team_eventId_status_idx" ON "Team"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Team_eventId_name_key" ON "Team"("eventId", "name");

-- CreateIndex
CREATE INDEX "Player_eventId_idx" ON "Player"("eventId");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_eventId_userId_key" ON "Player"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "QRCode_payload_key" ON "QRCode"("payload");

-- CreateIndex
CREATE INDEX "QRCode_eventId_idx" ON "QRCode"("eventId");

-- CreateIndex
CREATE INDEX "QRCode_eventId_status_idx" ON "QRCode"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QRCode_eventId_label_key" ON "QRCode"("eventId", "label");

-- CreateIndex
CREATE INDEX "QRCodeClaim_eventId_playerId_idx" ON "QRCodeClaim"("eventId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "QRCodeClaim_qrCodeId_playerId_key" ON "QRCodeClaim"("qrCodeId", "playerId");

-- CreateIndex
CREATE INDEX "ScanRecord_eventId_createdAt_idx" ON "ScanRecord"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "ScanRecord_playerId_createdAt_idx" ON "ScanRecord"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "ScanRecord_outcome_idx" ON "ScanRecord"("outcome");

-- CreateIndex
CREATE INDEX "TeamStateTransition_eventId_createdAt_idx" ON "TeamStateTransition"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamStateTransition_teamId_createdAt_idx" ON "TeamStateTransition"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminActionAudit_eventId_createdAt_idx" ON "AdminActionAudit"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminActionAudit_actorUserId_createdAt_idx" ON "AdminActionAudit"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Rescue_eventId_initiatedAt_idx" ON "Rescue"("eventId", "initiatedAt");

-- CreateIndex
CREATE INDEX "Rescue_requestingPlayerId_idx" ON "Rescue"("requestingPlayerId");

-- CreateIndex
CREATE INDEX "Rescue_requestingTeamId_idx" ON "Rescue"("requestingTeamId");

-- AddForeignKey
ALTER TABLE "EventConfig" ADD CONSTRAINT "EventConfig_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRCodeClaim" ADD CONSTRAINT "QRCodeClaim_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRCodeClaim" ADD CONSTRAINT "QRCodeClaim_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QRCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRCodeClaim" ADD CONSTRAINT "QRCodeClaim_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanRecord" ADD CONSTRAINT "ScanRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanRecord" ADD CONSTRAINT "ScanRecord_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QRCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanRecord" ADD CONSTRAINT "ScanRecord_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanRecord" ADD CONSTRAINT "ScanRecord_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStateTransition" ADD CONSTRAINT "TeamStateTransition_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStateTransition" ADD CONSTRAINT "TeamStateTransition_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStateTransition" ADD CONSTRAINT "TeamStateTransition_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStateTransition" ADD CONSTRAINT "TeamStateTransition_triggeredByPlayerId_fkey" FOREIGN KEY ("triggeredByPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActionAudit" ADD CONSTRAINT "AdminActionAudit_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActionAudit" ADD CONSTRAINT "AdminActionAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rescue" ADD CONSTRAINT "Rescue_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rescue" ADD CONSTRAINT "Rescue_requestingPlayerId_fkey" FOREIGN KEY ("requestingPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rescue" ADD CONSTRAINT "Rescue_requestingTeamId_fkey" FOREIGN KEY ("requestingTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rescue" ADD CONSTRAINT "Rescue_rescuerUserId_fkey" FOREIGN KEY ("rescuerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

