-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('MAILTRAP');

-- AlterEnum
ALTER TYPE "AdminActionType" ADD VALUE 'EMAIL_RETURN_FLAGGED';

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "hasReturnEmailIssue" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hasReturnEmailIssue" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "provider" "EmailProvider" NOT NULL,
    "providerEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recipientEmailRaw" TEXT NOT NULL,
    "recipientEmailNormalized" TEXT NOT NULL,
    "messageId" TEXT,
    "sendingStream" TEXT,
    "inboxId" TEXT,
    "isReturnSignal" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "eventId" TEXT,
    "userId" TEXT,
    "playerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailEvent_recipientEmailNormalized_occurredAt_idx" ON "EmailEvent"("recipientEmailNormalized", "occurredAt");

-- CreateIndex
CREATE INDEX "EmailEvent_isReturnSignal_occurredAt_idx" ON "EmailEvent"("isReturnSignal", "occurredAt");

-- CreateIndex
CREATE INDEX "EmailEvent_eventType_occurredAt_idx" ON "EmailEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "EmailEvent_eventId_createdAt_idx" ON "EmailEvent"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailEvent_userId_createdAt_idx" ON "EmailEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailEvent_playerId_createdAt_idx" ON "EmailEvent"("playerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailEvent_provider_providerEventId_key" ON "EmailEvent"("provider", "providerEventId");

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
