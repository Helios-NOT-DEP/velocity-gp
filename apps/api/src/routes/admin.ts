import { Router } from 'express';
import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getRequestAuthContext } from '../lib/requestAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { validate } from '../middleware/validate.js';
import {
  adminEventParamsSchema,
  adminEventTeamParamsSchema,
  adminUserParamsSchema,
  manualPitControlSchema,
  updateHeliosRoleSchema,
  updateRaceControlSchema,
} from '@velocity-gp/api-contract/schemas';
import {
  listAdminAudits,
  manualPitControl,
  updateHeliosRole,
  updateRaceControl,
} from '../services/adminControlService.js';

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

adminRouter.post(
  '/admin/events/:eventId/race-control',
  validate(adminEventParamsSchema, 'params'),
  validate(updateRaceControlSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const authContext = getRequestAuthContext(response);

    response.json(
      successResponse(
        await updateRaceControl(eventId, request.body, {
          actorUserId: authContext?.userId,
        }),
        {
          requestId: response.locals.requestId,
        }
      )
    );
  })
);

adminRouter.post(
  '/admin/events/:eventId/teams/:teamId/pit-control',
  validate(adminEventTeamParamsSchema, 'params'),
  validate(manualPitControlSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const teamId = String(request.params.teamId);
    const authContext = getRequestAuthContext(response);

    response.json(
      successResponse(
        await manualPitControl(eventId, teamId, request.body, {
          actorUserId: authContext?.userId,
        }),
        {
          requestId: response.locals.requestId,
        }
      )
    );
  })
);

adminRouter.post(
  '/admin/users/:userId/helios-role',
  validate(adminUserParamsSchema, 'params'),
  validate(updateHeliosRoleSchema),
  asyncHandler(async (request, response) => {
    const userId = String(request.params.userId);
    const authContext = getRequestAuthContext(response);

    response.json(
      successResponse(
        await updateHeliosRole(userId, request.body, {
          actorUserId: authContext?.userId,
        }),
        {
          requestId: response.locals.requestId,
        }
      )
    );
  })
);

adminRouter.get(
  '/admin/events/:eventId/audits',
  validate(adminEventParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);

    response.json(
      successResponse(await listAdminAudits(eventId), { requestId: response.locals.requestId })
    );
  })
);
