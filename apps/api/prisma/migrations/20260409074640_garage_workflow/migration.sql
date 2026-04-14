-- CreateEnum
CREATE TYPE "GarageSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TeamLogoStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "logoGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "logoStatus" "TeamLogoStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "requiredPlayerCount" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "GarageSubmission" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "GarageSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarageSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GarageSubmission_teamId_status_idx" ON "GarageSubmission"("teamId", "status");

-- CreateIndex
CREATE INDEX "GarageSubmission_eventId_idx" ON "GarageSubmission"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "GarageSubmission_playerId_teamId_key" ON "GarageSubmission"("playerId", "teamId");

-- AddForeignKey
ALTER TABLE "GarageSubmission" ADD CONSTRAINT "GarageSubmission_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageSubmission" ADD CONSTRAINT "GarageSubmission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageSubmission" ADD CONSTRAINT "GarageSubmission_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
