/**
 * @file teamSchemas.ts
 * @description Schema validation enforcing rules over creation and modification of Teams.
 */

import { z } from 'zod';

/** Extracts a Team ID from endpoints. */
export const teamParamsSchema = z.object({
  teamId: z.string().min(1),
});

/** Bounds new Team additions to limit unparseable names globally. */
export const createTeamSchema = z.object({
  name: z.string().min(2),
  eventId: z.string().min(1),
});

/** Safeguards against malformed payloads seeking to insert players onto Teams. */
export const joinTeamSchema = z.object({
  playerId: z.string().min(1),
});
