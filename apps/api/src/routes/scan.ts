import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requirePlayer } from '../middleware/requirePlayer.js';
import { eventScanParamsSchema, submitScanSchema } from '@velocity-gp/api-contract/schemas';
import { submitScan } from '../services/scanService.js';
import { getRequestAuthContext, resolveRequestAuthContext } from '../lib/requestAuth.js';
import { ForbiddenError } from '../utils/appError.js';

export const scanRouter = Router();
const scanRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (request) => {
    const authContext = resolveRequestAuthContext(request);
    if (!authContext) {
      // Use the request IP as the rate-limit key when there's no auth context.
      // `ipKeyGenerator` from express-rate-limit expects an IP string, not the
      // full request object, so use `request.ip` which is the Express client IP.
      return `ip:${request.ip}`;
    }

    if (authContext.capabilities.player && !authContext.capabilities.admin) {
      // Prefer stable player identity so scan traffic is isolated per participant.
      return `player:${authContext.playerId ?? authContext.userId}`;
    }

    return `${authContext.role ?? 'capability'}:${authContext.userId}`;
  },
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
    // Legacy header-auth players may not carry playerId in auth context, so this
    // check only applies when playerId is available.
    if (
      authContext &&
      authContext.capabilities.player &&
      !authContext.capabilities.admin &&
      authContext.playerId &&
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
