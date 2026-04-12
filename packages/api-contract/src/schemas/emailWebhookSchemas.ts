/**
 * @file emailWebhookSchemas.ts
 * @description Zod structures mirroring incoming webhook traffic from SendGrid/Mailtrap.
 * Secures inbound analytics endpoints mapping external email state transitions
 * (Delivered, Bounced, Opened) to the internal logging matrix safely.
 */

import { z } from 'zod';

/**
 * Maps flat event blocks issued from third-party SMTP deliverability streams.
 * Permits raw logging dumps but attempts to extract and normalize crucial markers
 * like IDs and Recipient strings.
 */
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

/** Enforces the overall payload wrapper standard containing arrays of processed events. */
export const mailtrapEventsIngestSchema = z.object({
  processedAt: z.string().datetime().optional(),
  events: z.array(mailtrapEventSchema).min(1),
});
