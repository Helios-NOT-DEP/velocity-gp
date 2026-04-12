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
export const updateQrHazardRandomizerSchema = z.object({
  hazardWeightOverride: z.number().int().min(0).max(100).nullable(),
});
