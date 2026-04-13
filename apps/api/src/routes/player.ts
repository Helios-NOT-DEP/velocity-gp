import { type Request, Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  createPlayerSchema,
  heliosQrParamsSchema,
  playerParamsSchema,
  updatePlayerSchema,
} from '@velocity-gp/api-contract/schemas';
import { createPlayer, getPlayerProfile, updatePlayerProfile } from '../services/playerService.js';
import { getActiveSuperpowerQR, regenerateSuperpowerQR } from '../services/superpowerQrService.js';
import { requireHelios } from '../middleware/requireHelios.js';
import { getRequestAuthContext, resolveRequestAuthContext } from '../lib/requestAuth.js';
import { ForbiddenError } from '../utils/appError.js';

export const playerRouter = Router();

function buildRateLimitKey(request: Request): string {
  const authContext = resolveRequestAuthContext(request);
  if (!authContext) {
    return ipKeyGenerator(request.ip || 'unknown');
  }

  if (authContext.capabilities.player && !authContext.capabilities.admin) {
    return `player:${authContext.playerId ?? authContext.userId}`;
  }

  return `${authContext.role ?? 'capability'}:${authContext.userId}`;
}

const superpowerQrReadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: (request, _response) => buildRateLimitKey(request),
});

const superpowerQrRegenerateRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (request, _response) => buildRateLimitKey(request),
});

// Player CRUD/profile endpoints used by onboarding and profile screens.
playerRouter.post(
  '/players',
  validate(createPlayerSchema),
  asyncHandler(async (request, response) => {
    response
      .status(201)
      .json(successResponse(createPlayer(request.body), { requestId: response.locals.requestId }));
  })
);

playerRouter.get(
  '/players/:playerId',
  validate(playerParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const playerId = String(request.params.playerId);

    response.json(
      successResponse(getPlayerProfile(playerId), { requestId: response.locals.requestId })
    );
  })
);

playerRouter.put(
  '/players/:playerId',
  validate(playerParamsSchema, 'params'),
  validate(updatePlayerSchema),
  asyncHandler(async (request, response) => {
    const playerId = String(request.params.playerId);

    response.json(
      successResponse(updatePlayerProfile(playerId, request.body), {
        requestId: response.locals.requestId,
      })
    );
  })
);

// ---------------------------------------------------------------------------
// Helios Superpower QR endpoints
// ---------------------------------------------------------------------------

/**
 * GET /players/:playerId/superpower-qr
 * Returns the active identity-bound Superpower QR for the requesting Helios player.
 * Provisions a new asset on first access if none exists yet.
 */
playerRouter.get(
  '/players/:playerId/superpower-qr',
  superpowerQrReadRateLimiter,
  requireHelios,
  validate(heliosQrParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const authContext = getRequestAuthContext(response);
    const playerId = String(request.params.playerId);

    const { prisma } = await import('../db/client.js');
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { userId: true },
    });

    if (!player) {
      throw new ForbiddenError('Player not found.');
    }

    if (authContext?.role !== 'admin' && authContext?.userId !== player.userId) {
      throw new ForbiddenError('You may only access your own Superpower QR.');
    }

    const result = await getActiveSuperpowerQR(player.userId);
    response.json(successResponse(result, { requestId: response.locals.requestId }));
  })
);

/**
 * POST /players/:playerId/superpower-qr/regenerate
 * Revokes the current Superpower QR and returns a fresh replacement.
 */
playerRouter.post(
  '/players/:playerId/superpower-qr/regenerate',
  superpowerQrRegenerateRateLimiter,
  requireHelios,
  validate(heliosQrParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const authContext = getRequestAuthContext(response);
    const playerId = String(request.params.playerId);

    const { prisma } = await import('../db/client.js');
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { userId: true },
    });

    if (!player) {
      throw new ForbiddenError('Player not found.');
    }

    if (authContext?.role !== 'admin' && authContext?.userId !== player.userId) {
      throw new ForbiddenError('You may only regenerate your own Superpower QR.');
    }

    const result = await regenerateSuperpowerQR(player.userId);
    response.json(successResponse(result, { requestId: response.locals.requestId }));
  })
);
