import { Router } from 'express';

import { successResponse } from '../contracts/http.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { initiateRescueSchema, rescuePlayerParamsSchema } from '../schemas/rescueSchemas.js';
import { completeRescue, getRescueStatus, initiateRescue } from '../services/rescueService.js';

export const rescueRouter = Router();

rescueRouter.post(
  '/rescue/initiate',
  validate(initiateRescueSchema),
  asyncHandler(async (request, response) => {
    response
      .status(202)
      .json(
        successResponse(initiateRescue(request.body), { requestId: response.locals.requestId })
      );
  })
);

rescueRouter.get(
  '/rescue/:playerId/status',
  validate(rescuePlayerParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const playerId = String(request.params.playerId);

    response.json(
      successResponse(getRescueStatus(playerId), { requestId: response.locals.requestId })
    );
  })
);

rescueRouter.post(
  '/rescue/:playerId/complete',
  validate(rescuePlayerParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const playerId = String(request.params.playerId);

    response.json(
      successResponse(completeRescue(playerId), { requestId: response.locals.requestId })
    );
  })
);
