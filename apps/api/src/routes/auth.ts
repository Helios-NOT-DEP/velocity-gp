import { Router } from 'express';

import { successResponse } from '@velocity-gp/api-contract/http';
import { requestMagicLinkSchema, verifyMagicLinkSchema } from '@velocity-gp/api-contract/schemas';
import { env } from '../config/env.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  AUTH_SESSION_COOKIE_MAX_AGE_MS,
  AUTH_SESSION_COOKIE_NAME,
  getRoutingDecisionFromAuthInputs,
  getSessionFromAuthInputs,
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
    const verifyResult = await verifyMagicLink(request.body);
    response.cookie(AUTH_SESSION_COOKIE_NAME, verifyResult.sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: AUTH_SESSION_COOKIE_MAX_AGE_MS,
      path: '/',
    });
    response.json(successResponse(verifyResult, { requestId: response.locals.requestId }));
  })
);

authRouter.get(
  '/auth/session',
  asyncHandler(async (request, response) => {
    response.json(
      successResponse(
        await getSessionFromAuthInputs(request.header('authorization'), request.header('cookie')),
        {
          requestId: response.locals.requestId,
        }
      )
    );
  })
);

authRouter.get(
  '/auth/routing-decision',
  asyncHandler(async (request, response) => {
    response.json(
      successResponse(
        await getRoutingDecisionFromAuthInputs(
          request.header('authorization'),
          request.header('cookie')
        ),
        {
          requestId: response.locals.requestId,
        }
      )
    );
  })
);

authRouter.post(
  '/auth/logout',
  asyncHandler(async (_request, response) => {
    response.clearCookie(AUTH_SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
    });

    response.json(successResponse({ loggedOut: true }, { requestId: response.locals.requestId }));
  })
);
