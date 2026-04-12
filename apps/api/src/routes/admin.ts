import { Router } from 'express';
import type { ListAdminRosterQuery } from '@velocity-gp/api-contract';
import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getRequestAuthContext } from '../lib/requestAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { validate } from '../middleware/validate.js';
import {
  adminEventRosterPlayerParamsSchema,
  adminEventParamsSchema,
  adminEventQrCodeParamsSchema,
  adminEventTeamParamsSchema,
  adminUserParamsSchema,
  adminRosterListQuerySchema,
  manualPitControlSchema,
  rosterImportApplySchema,
  rosterImportPreviewSchema,
  updateRosterAssignmentSchema,
  updateQrHazardRandomizerSchema,
  updateHeliosRoleSchema,
  updateRaceControlSchema,
} from '@velocity-gp/api-contract/schemas';
import {
  listAdminAudits,
  manualPitControl,
  updateQrHazardRandomizer,
  updateHeliosRole,
  updateRaceControl,
} from '../services/adminControlService.js';
import {
  applyRosterImport,
  listAdminRoster,
  listAdminRosterTeams,
  previewRosterImport,
  updateRosterAssignment,
} from '../services/rosterService.js';

export const adminRouter = Router();

// Apply admin authorization once for all /admin-prefixed endpoints in this router.
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

adminRouter.get(
  '/admin/events/:eventId/roster',
  validate(adminEventParamsSchema, 'params'),
  validate(adminRosterListQuerySchema, 'query'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);

    response.json(
      successResponse(await listAdminRoster(eventId, request.query as ListAdminRosterQuery), {
        requestId: response.locals.requestId,
      })
    );
  })
);

adminRouter.get(
  '/admin/events/:eventId/roster/teams',
  validate(adminEventParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);

    response.json(
      successResponse(await listAdminRosterTeams(eventId), { requestId: response.locals.requestId })
    );
  })
);

adminRouter.patch(
  '/admin/events/:eventId/roster/players/:playerId/assignment',
  validate(adminEventRosterPlayerParamsSchema, 'params'),
  validate(updateRosterAssignmentSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const playerId = String(request.params.playerId);
    const authContext = getRequestAuthContext(response);

    response.json(
      successResponse(
        await updateRosterAssignment(eventId, playerId, request.body, {
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
  '/admin/events/:eventId/roster/import/preview',
  validate(adminEventParamsSchema, 'params'),
  validate(rosterImportPreviewSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    response.json(
      successResponse(await previewRosterImport(eventId, request.body), {
        requestId: response.locals.requestId,
      })
    );
  })
);

adminRouter.post(
  '/admin/events/:eventId/roster/import/apply',
  validate(adminEventParamsSchema, 'params'),
  validate(rosterImportApplySchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const authContext = getRequestAuthContext(response);
    response.json(
      successResponse(
        await applyRosterImport(eventId, request.body, {
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

adminRouter.patch(
  '/admin/events/:eventId/qr-codes/:qrCodeId/hazard-randomizer',
  validate(adminEventQrCodeParamsSchema, 'params'),
  validate(updateQrHazardRandomizerSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const qrCodeId = String(request.params.qrCodeId);
    const authContext = getRequestAuthContext(response);

    response.json(
      successResponse(
        await updateQrHazardRandomizer(eventId, qrCodeId, request.body, {
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
