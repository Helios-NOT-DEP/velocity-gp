import { Router } from 'express';

import { successResponse } from '../contracts/http.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  eventHazardsParamsSchema,
  hazardParamsSchema,
  scanHazardSchema,
} from '../schemas/hazardSchemas.js';
import { getHazard, listHazards, scanHazard } from '../services/hazardService.js';

export const hazardRouter = Router();

hazardRouter.post(
  '/hazards/scan',
  validate(scanHazardSchema),
  asyncHandler(async (request, response) => {
    response.json(
      successResponse(scanHazard(request.body), { requestId: response.locals.requestId })
    );
  })
);

hazardRouter.get(
  '/hazards/:hazardId',
  validate(hazardParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const hazardId = String(request.params.hazardId);

    response.json(successResponse(getHazard(hazardId), { requestId: response.locals.requestId }));
  })
);

hazardRouter.get(
  '/events/:eventId/hazards',
  validate(eventHazardsParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);

    response.json(successResponse(listHazards(eventId), { requestId: response.locals.requestId }));
  })
);
