/**
 * @file teamActivitySchemas.ts
 * @description Validation schemas for team-scoped activity feed APIs.
 */

import { z } from 'zod';

export const teamActivityFeedParamsSchema = z.object({
  eventId: z.string().min(1),
  teamId: z.string().min(1),
});

export const teamActivityFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
