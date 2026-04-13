/**
 * @file playerSchemas.ts
 * @description Safety thresholds applied toward user profile updates and creations.
 * Strips dangerous inputs from arbitrary player profile writes or registrations.
 */

import { z } from 'zod';

/** URL extractor enforcing presence of player entity identifiers. */
export const playerParamsSchema = z.object({
  playerId: z.string().min(1),
});

/**
 * Constrains registration creation structures. Requires an email and display name
 * but optionally catches Team inclusion.
 */
export const createPlayerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  eventId: z.string().min(1),
  teamId: z.string().min(1).optional(),
});

/** Guards mutation commands allowing name changes or team shuffling logic dynamically. */
export const updatePlayerSchema = z.object({
  name: z.string().min(2).optional(),
  teamId: z.string().min(1).nullable().optional(),
});

/**
 * URL param extractor for Helios Superpower QR endpoints.
 * Requires the caller to supply a valid player identifier in the route path.
 */
export const heliosQrParamsSchema = z.object({
  playerId: z.string().min(1),
});
