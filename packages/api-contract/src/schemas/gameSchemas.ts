/**
 * @file gameSchemas.ts
 * @description Validates fundamental game loop interaction parameters such as requesting
 * dynamic race conditions, checking leaderboards, and reconciling scan actions.
 */

import { z } from 'zod';

/** URL Parameter guard ensuring a system requests race-state with proper IDs. */
export const raceStateParamsSchema = z.object({
  eventId: z.string().min(1),
  playerId: z.string().min(1),
});

/** URL Parameter guard enforcing structure on an Event leaderboard query. */
export const leaderboardParamsSchema = z.object({
  eventId: z.string().min(1),
});

/** URL Parameter guard defining the namespace mapping a Scan context. */
export const eventScanParamsSchema = z.object({
  eventId: z.string().min(1),
});

/** Defines structured payload guarding the submission representing a Hazard Encounter completion. */
export const hazardStatusSchema = z.object({
  hazardId: z.string().min(1),
  status: z.enum(['ENCOUNTERED', 'RESOLVED']),
});
