/**
 * @file rescueSchemas.ts
 * @description Enforces format parameters bridging physical Rescue operations from
 * the frontend clients over to the operational Database mechanisms safely.
 */

import { z } from 'zod';

/** Extractor isolating the Player identifier from rescue endpoint strings. */
export const rescuePlayerParamsSchema = z.object({
  playerId: z.string().min(1),
});

/**
 * Safety payload requiring critical association markers (Player, Event) are intact
 * before kicking off an asynchronous Rescue state for a penalized team.
 */
export const initiateRescueSchema = z.object({
  playerId: z.string().min(1),
  eventId: z.string().min(1),
  heliosQrId: z.string().min(1).optional(),
  reason: z.string().min(2).optional(),
});

/**
 * Query schema for rescue log retrieval.
 *
 * Service-layer business validation still governs cooldown and rescue eligibility.
 */
export const rescueLogQuerySchema = z.object({
  eventId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
