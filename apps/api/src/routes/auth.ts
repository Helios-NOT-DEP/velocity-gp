import type { ExpressAuthConfig } from '@auth/express';
import { Router } from 'express';

import { successResponse } from '@velocity-gp/api-contract';

import { buildAuthSessionResponse } from '../auth/session.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../lib/asyncHandler.js';

export function createAuthApiRouter(authConfig: ExpressAuthConfig) {
  const authApiRouter = Router();

  authApiRouter.get(
    '/auth/session',
    asyncHandler(async (request, response) => {
      response.json(
        successResponse(await buildAuthSessionResponse(request, authConfig, env.AUTH_EVENT_ID), {
          requestId: response.locals.requestId,
        })
      );
    })
  );

  return authApiRouter;
}
