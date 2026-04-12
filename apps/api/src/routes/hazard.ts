import { Router } from 'express';

import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  eventHazardsParamsSchema,
  hazardParamsSchema,
  scanHazardSchema,
} from '@velocity-gp/api-contract/schemas';
import { getHazard, listHazards, scanHazard } from '../services/hazardService.js';

export const hazardRouter = Router();

// Legacy hazard endpoints retained while scan clients migrate to /events/:eventId/scans.
hazardRouter.post(
  '/hazards/scan',
  validate(scanHazardSchema),
  asyncHandler(async (request, response) => {
    response.json(
      successResponse(await scanHazard(request.body), { requestId: response.locals.requestId })
    );
  })
);

hazardRouter.get(
  '/qr-codes/:hazardId',
  validate(hazardParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const hazardId = String(request.params.hazardId);

    response.json(
      successResponse(await getHazard(hazardId), { requestId: response.locals.requestId })
    );
  })
);

hazardRouter.get(
  '/hazards/:hazardId',
  validate(hazardParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const hazardId = String(request.params.hazardId);

    response.json(
      successResponse(await getHazard(hazardId), { requestId: response.locals.requestId })
    );
  })
);

hazardRouter.get(
  '/events/:eventId/qr-codes',
  validate(eventHazardsParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);

    response.json(
      successResponse(await listHazards(eventId), { requestId: response.locals.requestId })
    );
  })
);

hazardRouter.get(
  '/events/:eventId/hazards',
  validate(eventHazardsParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);

    response.json(
      successResponse(await listHazards(eventId), { requestId: response.locals.requestId })
    );
  })
);
