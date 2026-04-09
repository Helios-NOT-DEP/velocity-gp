import { z } from 'zod';

export const mailtrapEventSchema = z.object({
  eventType: z.string().min(1),
  timestamp: z.string().datetime().optional(),
  recipientEmail: z.string().email(),
  messageId: z.string().min(1).nullable().optional(),
  sendingStream: z.string().min(1).nullable().optional(),
  inboxId: z.string().min(1).nullable().optional(),
  providerEventId: z.string().min(1).nullable().optional(),
  eventId: z.string().min(1).nullable().optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

export const mailtrapEventsIngestSchema = z.object({
  processedAt: z.string().datetime().optional(),
  events: z.array(mailtrapEventSchema).min(1),
});
