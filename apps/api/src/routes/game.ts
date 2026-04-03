import { Router } from 'express';

import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  hazardStatusSchema,
  leaderboardParamsSchema,
  raceStateParamsSchema,
} from '@velocity-gp/api-contract/schemas';
import { getLeaderboard, getRaceState, updateHazardStatus } from '../services/gameService.js';

export const gameRouter = Router();

gameRouter.get(
  '/events/:eventId/players/:playerId/race-state',
  validate(raceStateParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const playerId = String(request.params.playerId);

    response.json(
      successResponse(getRaceState(eventId, playerId), { requestId: response.locals.requestId })
    );
  })
);

gameRouter.post(
  '/events/:eventId/players/:playerId/hazard-status',
  validate(raceStateParamsSchema, 'params'),
  validate(hazardStatusSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const playerId = String(request.params.playerId);

    response.json(
      successResponse(updateHazardStatus(eventId, playerId, request.body), {
        requestId: response.locals.requestId,
      })
    );
  })
);

gameRouter.get(
  '/events/:eventId/leaderboard',
  validate(leaderboardParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);

    response.json(
      successResponse(getLeaderboard(eventId), { requestId: response.locals.requestId })
    );
  })
);
