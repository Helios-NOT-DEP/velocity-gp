/**
 * @file hazardSchemas.ts
 * @description Zod guards limiting external manipulation of Hazard constructs and
 * verifying QR Scan transactions. Ensures scanned QR codes are properly formed.
 */

import { z } from 'zod';

/** Extractor schema for URL endpoints querying a specific distinct hazard. */
export const hazardParamsSchema = z.object({
  hazardId: z.string().min(1),
});

/** Extractor schema governing the batch list querying an event's hazard pool. */
export const eventHazardsParamsSchema = z.object({
  eventId: z.string().min(1),
});

/** Validates legacy format of frontend client submitting a physical QR hash payload. */
export const scanHazardSchema = z.object({
  playerId: z.string().min(1),
  eventId: z.string().min(1),
  qrCode: z.string().min(1),
});

/** Formats incoming game logic triggers representing modern camera QR intercepts. */
export const submitScanSchema = z.object({
  playerId: z.string().min(1),
  qrPayload: z.string().min(1),
});
