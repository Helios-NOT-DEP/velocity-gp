import { z } from 'zod';

export const hazardParamsSchema = z.object({
  hazardId: z.string().min(1),
});

export const eventHazardsParamsSchema = z.object({
  eventId: z.string().min(1),
});

export const scanHazardSchema = z.object({
  playerId: z.string().min(1),
  eventId: z.string().min(1),
  qrCode: z.string().min(1),
});
