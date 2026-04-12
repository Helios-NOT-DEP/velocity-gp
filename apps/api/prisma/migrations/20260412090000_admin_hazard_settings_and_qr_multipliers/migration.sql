ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'EVENT_HAZARD_SETTINGS_UPDATED';
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'QR_IMPORT_APPLIED';
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'HAZARD_MULTIPLIER_CREATED';
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'HAZARD_MULTIPLIER_UPDATED';
ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'HAZARD_MULTIPLIER_DELETED';

CREATE TABLE IF NOT EXISTS "HazardMultiplierRule" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "ratioMultiplier" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "HazardMultiplierRule_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'HazardMultiplierRule_eventId_fkey'
  ) THEN
    ALTER TABLE "HazardMultiplierRule"
      ADD CONSTRAINT "HazardMultiplierRule_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "HazardMultiplierRule_eventId_startsAt_idx"
  ON "HazardMultiplierRule"("eventId", "startsAt");

CREATE INDEX IF NOT EXISTS "HazardMultiplierRule_eventId_endsAt_idx"
  ON "HazardMultiplierRule"("eventId", "endsAt");

CREATE INDEX IF NOT EXISTS "HazardMultiplierRule_eventId_deletedAt_idx"
  ON "HazardMultiplierRule"("eventId", "deletedAt");
