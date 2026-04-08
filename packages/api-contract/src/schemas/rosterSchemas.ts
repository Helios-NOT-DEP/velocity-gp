import { z } from 'zod';

export const rosterAssignmentStatusSchema = z.enum([
  'ASSIGNED_PENDING',
  'ASSIGNED_ACTIVE',
  'UNASSIGNED',
]);

export const phoneE164Schema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone number must be in E.164 format (e.g. +15551234567).');

export const rosterImportRowSchema = z.object({
  workEmail: z.string().email(),
  displayName: z.string().min(1),
  phoneE164: z.string().min(1).max(64).nullable().optional(),
  teamName: z.string().min(1).nullable().optional(),
});

export const adminEventRosterPlayerParamsSchema = z.object({
  eventId: z.string().min(1),
  playerId: z.string().min(1),
});

export const adminRosterListQuerySchema = z.object({
  q: z.string().min(1).max(120).optional(),
  assignmentStatus: rosterAssignmentStatusSchema.optional(),
  teamId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});

export const updateRosterAssignmentSchema = z.object({
  teamId: z.string().min(1).nullable(),
  reason: z.string().min(2).max(500).optional(),
});

export const rosterImportPreviewSchema = z.object({
  rows: z.array(rosterImportRowSchema).min(1).max(5_000),
});

export const rosterImportApplySchema = z.object({
  rows: z.array(rosterImportRowSchema).min(1).max(5_000),
});
