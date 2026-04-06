import { z } from 'zod';

export const raceStateParamsSchema = z.object({
  eventId: z.string().min(1),
  playerId: z.string().min(1),
});

export const leaderboardParamsSchema = z.object({
  eventId: z.string().min(1),
});

export const eventScanParamsSchema = z.object({
  eventId: z.string().min(1),
});

export const hazardStatusSchema = z.object({
  hazardId: z.string().min(1),
  status: z.enum(['ENCOUNTERED', 'RESOLVED']),
});
