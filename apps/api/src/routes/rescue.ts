import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { successResponse } from '@velocity-gp/api-contract/http';
import { resolveRequestAuthContext } from '../lib/requestAuth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requirePlayer } from '../middleware/requirePlayer.js';
import { initiateRescueSchema, rescuePlayerParamsSchema } from '@velocity-gp/api-contract/schemas';
import { completeRescue, getRescueStatus, initiateRescue } from '../services/rescueService.js';

export const rescueRouter = Router();

const rescueRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (request) => {
    const authContext = resolveRequestAuthContext(request);
    if (!authContext) {
      return `ip:${request.ip}`;
    }

    if (authContext.capabilities.player && !authContext.capabilities.admin) {
      return `player:${authContext.playerId ?? authContext.userId}`;
    }

    return `${authContext.role ?? 'capability'}:${authContext.userId}`;
  },
});

// Rescue workflow endpoints for Helios intervention lifecycle.
rescueRouter.post(
  '/rescue/initiate',
  rescueRateLimiter,
  requirePlayer,
  validate(initiateRescueSchema),
  asyncHandler(async (request, response) => {
    const authContext = resolveRequestAuthContext(request);

    response.status(202).json(
      successResponse(
        await initiateRescue({
          ...request.body,
          scannerUserId: authContext?.userId,
        }),
        { requestId: response.locals.requestId }
      )
    );
  })
);

rescueRouter.get(
  '/rescue/:playerId/status',
  rescueRateLimiter,
  requirePlayer,
  validate(rescuePlayerParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const playerId = String(request.params.playerId);

    response.json(
      successResponse(await getRescueStatus(playerId), { requestId: response.locals.requestId })
    );
  })
);

rescueRouter.post(
  '/rescue/:playerId/complete',
  rescueRateLimiter,
  requirePlayer,
  validate(rescuePlayerParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const playerId = String(request.params.playerId);

    response.json(
      successResponse(await completeRescue(playerId), { requestId: response.locals.requestId })
    );
  })
);
