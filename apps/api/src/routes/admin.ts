import { Router } from 'express';
import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getRequestAuthContext } from '../lib/requestAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const adminRouter = Router();

adminRouter.use('/admin', requireAdmin);

adminRouter.get(
  '/admin/session',
  asyncHandler(async (_request, response) => {
    const authContext = getRequestAuthContext(response);

    response.json(
      successResponse(
        {
          userId: authContext?.userId ?? null,
          role: authContext?.role ?? null,
          scope: 'admin',
        },
        { requestId: response.locals.requestId }
      )
    );
  })
);
