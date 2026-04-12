/**
 * @file adminSchemas.ts
 * @description Structural validators specifically aimed at guarding Administration routes.
 * Extensively limits invalid parameter tampering when Helios or Admins override
 * game balances, team statuses, and application user rights.
 */

import { z } from 'zod';

/** Enforces valid structure for extracting event IDs from URL strings. */
export const adminEventParamsSchema = z.object({
  eventId: z.string().min(1),
});

/** Enforces valid structure targeting both a specific event and a specific participant team. */
export const adminEventTeamParamsSchema = z.object({
  eventId: z.string().min(1),
  teamId: z.string().min(1),
});

/** Guards against invalid inputs when targeting modifying a physical QR entity administratively. */
export const adminEventQrCodeParamsSchema = z.object({
  eventId: z.string().min(1),
  qrCodeId: z.string().min(1),
});

export const adminEventMultiplierRuleParamsSchema = z.object({
  eventId: z.string().min(1),
  ruleId: z.string().min(1),
});

/** Enforces structure for generic user mutation endpoints. */
export const adminUserParamsSchema = z.object({
  userId: z.string().min(1),
});

/**
 * Guarantees that any command hitting Race Control adheres precisely to allowed
 * Enum states (e.g., ACTIVE or PAUSED) and optional audit reasoning strings.
 */
export const updateRaceControlSchema = z.object({
  state: z.enum(['ACTIVE', 'PAUSED']),
  reason: z.string().min(2).optional(),
});

/**
 * Confirms payloads intended to bypass RNG-based Pits provide legal instructions
 * like 'ENTER_PIT' and conform to correct date-time structures.
 */
export const manualPitControlSchema = z.object({
  action: z.enum(['ENTER_PIT', 'CLEAR_PIT']),
  pitStopExpiresAt: z.string().datetime().optional(),
  reason: z.string().min(2).optional(),
});

/** Defends endpoints toggling sensitive HELIOS authorization logic. */
export const updateHeliosRoleSchema = z.object({
  isHelios: z.boolean(),
  reason: z.string().min(2).optional(),
});

/**
 * Strict numeric enforcement preventing users from setting impossible hazard weights.
 * Locks between 0-100 to represent proper probability spread.
 */
export const updateQrHazardRandomizerSchema = z
  .object({
    hazardRatioOverride: z.number().int().min(1).max(10_000).nullable().optional(),
    hazardWeightOverride: z.number().int().min(0).max(100).nullable().optional(),
  })
  .refine(
    (value) =>
      Object.prototype.hasOwnProperty.call(value, 'hazardRatioOverride') ||
      Object.prototype.hasOwnProperty.call(value, 'hazardWeightOverride'),
    {
      message: 'At least one override must be provided.',
      path: ['hazardWeightOverride'],
    }
  );

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    return value;
  });

/**
 * Validates admin QR creation payloads including optional activation windows.
 */
export const createAdminQRCodeSchema = z
  .object({
    label: z.string().trim().min(1),
    value: z.number().int().positive(),
    zone: optionalTrimmedString,
    activationStartsAt: z.string().datetime().optional(),
    activationEndsAt: z.string().datetime().optional(),
    hazardRatioOverride: z.number().int().min(1).max(10_000).nullable().optional(),
    hazardWeightOverride: z.number().int().min(0).max(100).nullable().optional(),
  })
  .refine(
    (value) => {
      if (!value.activationStartsAt || !value.activationEndsAt) {
        return true;
      }

      return (
        new Date(value.activationStartsAt).getTime() < new Date(value.activationEndsAt).getTime()
      );
    },
    {
      message: 'activationEndsAt must be later than activationStartsAt.',
      path: ['activationEndsAt'],
    }
  );

/**
 * Validates status changes for existing QR codes.
 */
export const setAdminQRCodeStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']),
  reason: z.string().trim().min(2).optional(),
});

export const updateEventHazardSettingsSchema = z.object({
  globalHazardRatio: z.number().int().min(1).max(10_000),
  reason: z.string().trim().min(2).optional(),
});

const qrImportRowSchema = z
  .object({
    label: z.string().trim().min(1),
    value: z.number().int().positive(),
    zone: z.string().trim().min(1).nullable().optional(),
    activationStartsAt: z.string().datetime().nullable().optional(),
    activationEndsAt: z.string().datetime().nullable().optional(),
    hazardRatioOverride: z.number().int().min(1).max(10_000).nullable().optional(),
    hazardWeightOverride: z.number().int().min(0).max(100).nullable().optional(),
  })
  .refine(
    (value) => {
      if (!value.activationStartsAt || !value.activationEndsAt) {
        return true;
      }
      return (
        new Date(value.activationStartsAt).getTime() < new Date(value.activationEndsAt).getTime()
      );
    },
    {
      message: 'activationEndsAt must be later than activationStartsAt.',
      path: ['activationEndsAt'],
    }
  );

export const qrImportPreviewSchema = z.object({
  rows: z.array(qrImportRowSchema).min(1).max(5_000),
});

export const qrImportApplySchema = z.object({
  rows: z.array(qrImportRowSchema).min(1).max(5_000),
});

export const exportQrAssetsSchema = z.object({
  qrCodeIds: z.array(z.string().min(1)).min(1).max(5_000).optional(),
});

export const createHazardMultiplierRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    ratioMultiplier: z.number().positive().max(100),
  })
  .refine((value) => new Date(value.startsAt).getTime() < new Date(value.endsAt).getTime(), {
    message: 'endsAt must be later than startsAt.',
    path: ['endsAt'],
  });

export const updateHazardMultiplierRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    ratioMultiplier: z.number().positive().max(100).optional(),
  })
  .refine(
    (value) => {
      if (!value.startsAt || !value.endsAt) {
        return true;
      }
      return new Date(value.startsAt).getTime() < new Date(value.endsAt).getTime();
    },
    {
      message: 'endsAt must be later than startsAt.',
      path: ['endsAt'],
    }
  );

/**
 * Validates query parameters for listing admin audit entries.
 * Supports cursor-based pagination with a configurable page size.
 */
export const adminAuditListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
