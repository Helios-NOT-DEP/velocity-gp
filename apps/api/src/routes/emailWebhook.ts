import { Router } from 'express';
import { successResponse } from '@velocity-gp/api-contract/http';
import { mailtrapEventsIngestSchema } from '@velocity-gp/api-contract/schemas';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireN8nWebhookAuth } from '../middleware/requireN8nWebhookAuth.js';
import { validate } from '../middleware/validate.js';
import { ingestMailtrapEvents } from '../services/emailEventService.js';

export const emailWebhookRouter = Router();

emailWebhookRouter.post(
  '/webhooks/mailtrap/events',
  requireN8nWebhookAuth,
  validate(mailtrapEventsIngestSchema),
  asyncHandler(async (request, response) => {
    response.json(
      successResponse(await ingestMailtrapEvents(request.body), {
        requestId: response.locals.requestId,
      })
    );
  })
);
