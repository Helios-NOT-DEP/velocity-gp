/**
 * Garage Route
 *
 * Two endpoints that power the Garage workflow:
 *
 *   POST /garage/submit
 *     Accepts a player's self-description, moderates it, persists the result,
 *     and optionally fires logo generation.  Returns HTTP 200 for both approved
 *     and rejected outcomes so the UI can display policy messages gracefully.
 *
 *   GET /garage/team/:teamId/status?playerId=:playerId
 *     Polling endpoint — returns the current team garage status snapshot
 *     (logoStatus, counts, player's own submission state).
 *     The UI calls this every ~4 seconds while waiting.
 *
 * Both routes follow the project's existing pattern:
 *   validate middleware → asyncHandler → service call → successResponse
 */
import { Router } from 'express';

import { successResponse } from '@velocity-gp/api-contract/http';
import {
  garageSubmitSchema,
  garageTeamStatusParamsSchema,
  garageTeamStatusQuerySchema,
} from '@velocity-gp/api-contract/schemas';

import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { submitDescription, getTeamGarageStatus } from '../services/garageService.js';

export const garageRouter = Router();

// ── POST /garage/submit ───────────────────────────────────────────────────────
//
// Idempotent per player-team pair: submitting multiple times overwrites the
// previous entry (allows retry after rejection without manual admin intervention).
garageRouter.post(
  '/garage/submit',
  // Validate body against the Zod schema — rejects missing/malformed fields early
  validate(garageSubmitSchema),
  asyncHandler(async (request, response) => {
    // request.body is now fully typed by the Zod parse in validate()
    const result = await submitDescription(request.body);

    // Always 200: the `status` field in the body ('approved' | 'rejected') tells
    // the UI what happened — we don't use 422 here so error boundaries aren't
    // triggered for a normal policy rejection.
    response.json(successResponse(result, { requestId: response.locals.requestId }));
  })
);

// ── GET /garage/team/:teamId/status ───────────────────────────────────────────
//
// Polling endpoint used by the UI waiting state.  No DB writes; safe to call
// frequently (~4 s interval on the client).
garageRouter.get(
  '/garage/team/:teamId/status',
  validate(garageTeamStatusParamsSchema, 'params'),
  validate(garageTeamStatusQuerySchema, 'query'),
  asyncHandler(async (request, response) => {
    const teamId = String(request.params.teamId);
    // playerId is used to populate the `mySubmission` field in the response
    const playerId = String(request.query.playerId);

    const status = await getTeamGarageStatus(teamId, playerId);

    response.json(successResponse(status, { requestId: response.locals.requestId }));
  })
);
