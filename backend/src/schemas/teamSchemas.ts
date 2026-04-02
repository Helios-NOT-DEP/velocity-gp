import { z } from 'zod';

export const teamParamsSchema = z.object({
  teamId: z.string().min(1),
});

export const createTeamSchema = z.object({
  name: z.string().min(2),
  eventId: z.string().min(1),
});

export const joinTeamSchema = z.object({
  playerId: z.string().min(1),
});
