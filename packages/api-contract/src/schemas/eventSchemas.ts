import { z } from 'zod';

export const eventParamsSchema = z.object({
  eventId: z.string().min(1),
});
