import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requirePlayer } from '../middleware/requirePlayer.js';
import { eventScanParamsSchema, submitScanSchema } from '@velocity-gp/api-contract/schemas';
import { submitScan } from '../services/scanService.js';
import { getRequestAuthContext } from '../lib/requestAuth.js';
import { ForbiddenError } from '../utils/appError.js';

export const scanRouter = Router();
const scanRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

// Canonical scan ingestion endpoint; legacy scan path remains in hazard router.
scanRouter.post(
  '/events/:eventId/scans',
  scanRateLimiter,
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
      authContext.playerId !== request.body.playerId
    ) {
      throw new ForbiddenError('You may only submit scans for your own player account.', {
        sessionPlayerId: authContext.playerId,
        requestedPlayerId: request.body.playerId,
      });
    }

    const result = await submitScan({ eventId, request: request.body });

    // Scan submissions that are successfully processed should always return 200.
    // Clients must use the outcome field to distinguish game-logic results.
    response.status(200).json(
      successResponse(result, {
        requestId: response.locals.requestId,
      })
    );
  })
);
