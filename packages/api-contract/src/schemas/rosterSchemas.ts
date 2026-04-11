/**
 * @file rosterSchemas.ts
 * @description Zod parsing layers processing intense bulk-data imports (spreadsheets)
 * preventing poorly formatted lists from entering and breaking relational tables.
 */

import { z } from 'zod';

/** Enum representation enforcing strict assignment status tokens mapping to frontend routing states. */
export const rosterAssignmentStatusSchema = z.enum([
  'ASSIGNED_PENDING',
  'ASSIGNED_ACTIVE',
  'UNASSIGNED',
]);

/** Caps International phone strings to prevent Database injection limits breaking. */
export const phoneE164Schema = z.string().max(64);

/**
 * Heavily utilized parsing block checking single row items imported from a user spreadsheet.
 * Resolves fields like Work Email explicitly.
 */
export const rosterImportRowSchema = z.object({
  workEmail: z.string().email(),
  displayName: z.string().min(1),
  phoneE164: phoneE164Schema.nullable().optional(),
  teamName: z.string().min(1).nullable().optional(),
});

/** Endpoint extractor ensuring both Event and nested Player IDs exist. */
export const adminEventRosterPlayerParamsSchema = z.object({
  eventId: z.string().min(1),
  playerId: z.string().min(1),
});

/**
 * Paginates DataGrid arrays querying an Admin's Roster screen natively via strict string
 * and boolean boundaries against the backend.
 */
export const adminRosterListQuerySchema = z.object({
  q: z.string().min(1).max(120).optional(),
  assignmentStatus: rosterAssignmentStatusSchema.optional(),
  teamId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});

/** Format checking strings adjusting manual team allocation. */
export const updateRosterAssignmentSchema = z.object({
  teamId: z.string().min(1).nullable(),
  reason: z.string().min(2).max(500).optional(),
});

/** Safely arrays the Row schema checking the CSV before it can hit the Dry Run endpoint. */
export const rosterImportPreviewSchema = z.object({
  rows: z.array(rosterImportRowSchema).min(1).max(5_000),
});

/** Safely limits rows submitted to immediately execute on the live Database schema. */
export const rosterImportApplySchema = z.object({
  rows: z.array(rosterImportRowSchema).min(1).max(5_000),
});
