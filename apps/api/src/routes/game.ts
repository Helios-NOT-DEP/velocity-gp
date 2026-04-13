import { Router } from 'express';

import type { ListDisplayEventsQuery } from '@velocity-gp/api-contract';
import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  displayEventsParamsSchema,
  displayEventsQuerySchema,
  hazardStatusSchema,
  leaderboardParamsSchema,
  raceStateParamsSchema,
} from '@velocity-gp/api-contract/schemas';
import {
  getDisplayEvents,
  getLeaderboard,
  getRaceState,
  updateHazardStatus,
} from '../services/gameService.js';

export const gameRouter = Router();

// Race-state and leaderboard endpoints used by active gameplay surfaces.
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
      successResponse(await getLeaderboard(eventId), { requestId: response.locals.requestId })
    );
  })
);

gameRouter.get(
  '/events/:eventId/display-events',
  validate(displayEventsParamsSchema, 'params'),
  validate(displayEventsQuerySchema, 'query'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const query = request.query as ListDisplayEventsQuery;

    response.json(
      successResponse(await getDisplayEvents(eventId, query), {
        requestId: response.locals.requestId,
      })
    );
  })
);
