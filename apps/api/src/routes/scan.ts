import { Router } from 'express';

import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { eventScanParamsSchema, submitScanSchema } from '@velocity-gp/api-contract/schemas';
import { submitScan } from '../services/scanService.js';

export const scanRouter = Router();

scanRouter.post(
  '/events/:eventId/scans',
  validate(eventScanParamsSchema, 'params'),
  validate(submitScanSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);

    response.json(
      successResponse(submitScan({ eventId, request: request.body }), {
        requestId: response.locals.requestId,
      })
    );
  })
);
