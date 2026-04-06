import { z } from 'zod';

export const playerParamsSchema = z.object({
  playerId: z.string().min(1),
});

export const createPlayerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  eventId: z.string().min(1),
  teamId: z.string().min(1).optional(),
});

export const updatePlayerSchema = z.object({
  name: z.string().min(2).optional(),
  teamId: z.string().min(1).nullable().optional(),
});
