import { z } from 'zod';

export const adminEventParamsSchema = z.object({
  eventId: z.string().min(1),
});

export const adminEventTeamParamsSchema = z.object({
  eventId: z.string().min(1),
  teamId: z.string().min(1),
});

export const adminUserParamsSchema = z.object({
  userId: z.string().min(1),
});

export const updateRaceControlSchema = z.object({
  state: z.enum(['ACTIVE', 'PAUSED']),
  reason: z.string().min(2).optional(),
});

export const manualPitControlSchema = z.object({
  action: z.enum(['ENTER_PIT', 'CLEAR_PIT']),
  pitStopExpiresAt: z.string().datetime().optional(),
  reason: z.string().min(2).optional(),
});

export const updateHeliosRoleSchema = z.object({
  isHelios: z.boolean(),
  reason: z.string().min(2).optional(),
});
