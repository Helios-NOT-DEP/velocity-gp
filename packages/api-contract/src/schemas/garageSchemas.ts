/**
 * Garage Workflow Zod Schemas
 *
 * These schemas are used by the `validate` middleware on the API server to
 * shape-check incoming request bodies and URL parameters before any service
 * code runs.  Zod parses and coerces the values so downstream code can trust
 * the types completely.
 */
import { z } from 'zod';

/**
 * Validates the body of POST /garage/submit.
 *
 * description constraints match the UI textarea guidance:
 *   - Minimum 3 chars — prevents accidental single-letter submissions
 *   - Maximum 200 chars — keeps the OpenAI image prompt focused and cost-bounded
 */
export const garageSubmitSchema = z.object({
  playerId: z.string().min(1, 'playerId is required'),
  teamId: z.string().min(1, 'teamId is required'),
  eventId: z.string().min(1, 'eventId is required'),
  description: z
    .string()
    .min(3, 'Description must be at least 3 characters')
    .max(200, 'Description must be 200 characters or fewer')
    .trim(),
});

/**
 * Validates the `:teamId` path param on GET /garage/team/:teamId/status.
 */
export const garageTeamStatusParamsSchema = z.object({
  teamId: z.string().min(1, 'teamId is required'),
});

/**
 * Validates the `?playerId=` query param on the status endpoint.
 * The playerId is used to populate `mySubmission` in the response.
 */
export const garageTeamStatusQuerySchema = z.object({
  playerId: z.string().min(1, 'playerId query parameter is required'),
});
