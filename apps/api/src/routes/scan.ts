import { Router } from 'express';

import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requirePlayer } from '../middleware/requirePlayer.js';
import { eventScanParamsSchema, submitScanSchema } from '@velocity-gp/api-contract/schemas';
import { submitScan } from '../services/scanService.js';
import { getRequestAuthContext } from '../lib/requestAuth.js';
import { ForbiddenError } from '../utils/appError.js';

export const scanRouter = Router();

// Canonical scan ingestion endpoint; legacy scan path remains in hazard router.
scanRouter.post(
  '/events/:eventId/scans',
  requirePlayer,
  validate(eventScanParamsSchema, 'params'),
  validate(submitScanSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const authContext = getRequestAuthContext(response);

    // Enforce that the submitting session matches the playerId in the body.
    // Helios and admin callers are exempt — they may act on behalf of any player.
    if (
      authContext &&
      authContext.role === 'player' &&
      authContext.userId !== request.body.playerId
    ) {
      throw new ForbiddenError('You may only submit scans for your own player account.', {
        sessionUserId: authContext.userId,
        requestedPlayerId: request.body.playerId,
      });
    }

    const result = await submitScan({ eventId, request: request.body });

    // Map scan outcomes to semantically appropriate HTTP status codes.
    // 200: scan was processed and resulted in a state change (points awarded or pit applied).
    // 422: request was valid but rejected by game logic — clients should read the outcome field.
    const REJECTION_OUTCOMES = new Set(['DUPLICATE', 'BLOCKED', 'INVALID']);
    const statusCode = REJECTION_OUTCOMES.has(result.outcome) ? 422 : 200;

    response.status(statusCode).json(
      successResponse(result, {
        requestId: response.locals.requestId,
      })
    );
  })
);
