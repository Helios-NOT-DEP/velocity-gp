/**
 * @file eventSchemas.ts
 * @description Validates queries requesting overarching Event level structures.
 */

import { z } from 'zod';

/** Standard URL parameter guard extracting an event key reliably. */
export const eventParamsSchema = z.object({
  eventId: z.string().min(1),
});
