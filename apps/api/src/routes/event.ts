import { Router } from 'express';

import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { eventParamsSchema } from '@velocity-gp/api-contract/schemas';
import { getCurrentEvent, getEvent, listEvents } from '../services/eventService.js';

export const eventRouter = Router();

eventRouter.get(
  '/events',
  asyncHandler(async (_request, response) => {
    response.json(successResponse(listEvents(), { requestId: response.locals.requestId }));
  })
);

eventRouter.get(
  '/events/current',
  asyncHandler(async (_request, response) => {
    response.json(successResponse(getCurrentEvent(), { requestId: response.locals.requestId }));
  })
);

eventRouter.get(
  '/events/:eventId',
  validate(eventParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);

    response.json(successResponse(getEvent(eventId), { requestId: response.locals.requestId }));
  })
);
