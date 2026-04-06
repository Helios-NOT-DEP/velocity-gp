import { z } from 'zod';

export const rescuePlayerParamsSchema = z.object({
  playerId: z.string().min(1),
});

export const initiateRescueSchema = z.object({
  playerId: z.string().min(1),
  eventId: z.string().min(1),
  heliosQrId: z.string().min(1).optional(),
  reason: z.string().min(2).optional(),
});
