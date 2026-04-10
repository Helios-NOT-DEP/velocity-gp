import { Router } from 'express';
import { successResponse } from '@velocity-gp/api-contract/http';
import { mailtrapEventsIngestSchema } from '@velocity-gp/api-contract/schemas';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireMailtrapWebhookAuth } from '../middleware/requireMailtrapWebhookAuth.js';
import { validate } from '../middleware/validate.js';
import { ingestMailtrapEvents } from '../services/emailEventService.js';

export const emailWebhookRouter = Router();

// Provider webhook ingress is authenticated before payload validation.
emailWebhookRouter.post(
  '/webhooks/mailtrap/events',
  requireMailtrapWebhookAuth,
  validate(mailtrapEventsIngestSchema),
  asyncHandler(async (request, response) => {
    response.json(
      successResponse(await ingestMailtrapEvents(request.body), {
        requestId: response.locals.requestId,
      })
    );
  })
);
