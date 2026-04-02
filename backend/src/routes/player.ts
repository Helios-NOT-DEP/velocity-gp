import { Router } from 'express';

import { successResponse } from '../contracts/http.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  createPlayerSchema,
  playerParamsSchema,
  updatePlayerSchema,
} from '../schemas/playerSchemas.js';
import { createPlayer, getPlayerProfile, updatePlayerProfile } from '../services/playerService.js';

export const playerRouter = Router();

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
