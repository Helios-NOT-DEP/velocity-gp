import { Router } from 'express';

import { successResponse } from '@velocity-gp/api-contract/http';
import { requestMagicLinkSchema, verifyMagicLinkSchema } from '@velocity-gp/api-contract/schemas';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  getRoutingDecisionFromAuthorizationHeader,
  getSessionFromAuthorizationHeader,
  requestMagicLink,
  verifyMagicLink,
} from '../services/authService.js';

export const authRouter = Router();

// Magic-link endpoints own login/session lifecycle for all client surfaces.
authRouter.post(
  '/auth/magic-link/request',
  validate(requestMagicLinkSchema),
  asyncHandler(async (request, response) => {
    const result = await requestMagicLink(request.body);
    response.status(202).json(successResponse(result, { requestId: response.locals.requestId }));
  })
);

authRouter.post(
  '/auth/magic-link/verify',
  validate(verifyMagicLinkSchema),
  asyncHandler(async (request, response) => {
    response.json(
      successResponse(await verifyMagicLink(request.body), { requestId: response.locals.requestId })
    );
  })
);

authRouter.get(
  '/auth/session',
  asyncHandler(async (request, response) => {
    response.json(
      successResponse(await getSessionFromAuthorizationHeader(request.header('authorization')), {
        requestId: response.locals.requestId,
      })
    );
  })
);

authRouter.get(
  '/auth/routing-decision',
  asyncHandler(async (request, response) => {
    response.json(
      successResponse(
        await getRoutingDecisionFromAuthorizationHeader(request.header('authorization')),
        {
          requestId: response.locals.requestId,
        }
      )
    );
  })
);
