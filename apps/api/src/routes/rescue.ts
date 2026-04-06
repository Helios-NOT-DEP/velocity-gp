import { Router } from 'express';

import { successResponse } from '@velocity-gp/api-contract/http';
import { resolveRequestAuthContext } from '../lib/requestAuth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { initiateRescueSchema, rescuePlayerParamsSchema } from '@velocity-gp/api-contract/schemas';
import { completeRescue, getRescueStatus, initiateRescue } from '../services/rescueService.js';

export const rescueRouter = Router();

rescueRouter.post(
  '/rescue/initiate',
  validate(initiateRescueSchema),
  asyncHandler(async (request, response) => {
    const authContext = resolveRequestAuthContext(request);

    response.status(202).json(
      successResponse(
        await initiateRescue({
          ...request.body,
          scannerUserId: authContext?.userId,
        }),
        { requestId: response.locals.requestId }
      )
    );
  })
);

rescueRouter.get(
  '/rescue/:playerId/status',
  validate(rescuePlayerParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const playerId = String(request.params.playerId);

    response.json(
      successResponse(await getRescueStatus(playerId), { requestId: response.locals.requestId })
    );
  })
);

rescueRouter.post(
  '/rescue/:playerId/complete',
  validate(rescuePlayerParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const playerId = String(request.params.playerId);

    response.json(
      successResponse(await completeRescue(playerId), { requestId: response.locals.requestId })
    );
  })
);
