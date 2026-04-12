ALTER TABLE "User"
ADD COLUMN "canAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canPlayer" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "isHeliosMember" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET
  "canAdmin" = CASE WHEN "role" = 'ADMIN' THEN true ELSE false END,
  "canPlayer" = CASE WHEN "role" IN ('PLAYER', 'HELIOS') THEN true ELSE false END,
  "isHeliosMember" = CASE
    WHEN "role" = 'HELIOS' OR "isHelios" = true THEN true
    ELSE false
  END;

ALTER TYPE "AdminActionType" ADD VALUE IF NOT EXISTS 'USER_CAPABILITIES_UPDATED';
