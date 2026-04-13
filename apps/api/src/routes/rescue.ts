import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { successResponse } from '@velocity-gp/api-contract/http';
import { resolveRequestAuthContext } from '../lib/requestAuth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requirePlayer } from '../middleware/requirePlayer.js';
import { initiateRescueSchema, rescuePlayerParamsSchema } from '@velocity-gp/api-contract/schemas';
import {
  completeRescue,
  getRescueStatus,
  initiateRescue,
  listRescueLogByRescuer,
} from '../services/rescueService.js';
import { UnauthorizedError } from '../utils/appError.js';
import { z } from 'zod';

const rescueLogQuerySchema = z.object({
  eventId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const rescueRouter = Router();

const rescueRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (request, _response) => {
    const authContext = resolveRequestAuthContext(request);
    if (!authContext) {
      return ipKeyGenerator(request.ip || 'unknown');
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
  '/rescue/log',
  rescueRateLimiter,
  requirePlayer,
  validate(rescueLogQuerySchema, 'query'),
  asyncHandler(async (request, response) => {
    const authContext = resolveRequestAuthContext(request);
    if (!authContext?.userId) {
      throw new UnauthorizedError('Authentication is required.');
    }

    const eventId =
      typeof request.query.eventId === 'string' && request.query.eventId.length > 0
        ? request.query.eventId
        : undefined;
    const limit = typeof request.query.limit === 'number' ? request.query.limit : undefined;

    const rescues = await listRescueLogByRescuer(authContext.userId, {
      eventId,
      limit,
    });

    response.json(successResponse({ rescues }, { requestId: response.locals.requestId }));
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
