import { Router } from 'express';
import type { ListAdminRosterQuery } from '@velocity-gp/api-contract';
import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getRequestAuthContext } from '../lib/requestAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { validate } from '../middleware/validate.js';
import {
  adminEventMultiplierRuleParamsSchema,
  adminEventRosterPlayerParamsSchema,
  adminEventParamsSchema,
  adminEventQrCodeParamsSchema,
  adminEventTeamParamsSchema,
  adminUserParamsSchema,
  adminAuditListQuerySchema,
  adminRosterListQuerySchema,
  createHazardMultiplierRuleSchema,
  createAdminQRCodeSchema,
  exportQrAssetsSchema,
  manualPitControlSchema,
  qrImportApplySchema,
  qrImportPreviewSchema,
  rosterImportApplySchema,
  rosterImportPreviewSchema,
  adminPlayerScanHistoryQuerySchema,
  setAdminQRCodeStatusSchema,
  updateAdminPlayerContactSchema,
  updateAdminTeamScoreSchema,
  updateEventHazardSettingsSchema,
  updateHazardMultiplierRuleSchema,
  updateRosterAssignmentSchema,
  updateQrHazardRandomizerSchema,
  updateUserCapabilitiesSchema,
  updateHeliosRoleSchema,
  updateRaceControlSchema,
} from '@velocity-gp/api-contract/schemas';
import {
  createHazardMultiplierRule,
  deleteHazardMultiplierRule,
  getEventHazardSettings,
  getRaceControl,
  listHazardMultiplierRules,
  listAdminAudits,
  manualPitControl,
  updateEventHazardSettings,
  updateHazardMultiplierRule,
  updateQrHazardRandomizer,
  updateUserCapabilities,
  updateHeliosRole,
  updateRaceControl,
} from '../services/adminControlService.js';
import {
  applyQrImport,
  createAdminQRCode,
  exportQrAssets,
  listAdminQRCodes,
  previewQrImport,
  setAdminQRCodeStatus,
  softDeleteAdminQRCode,
} from '../services/adminQrCodeService.js';
import {
  applyRosterImport,
  deleteAdminTeam,
  getAdminPlayerDetail,
  getAdminTeamDetail,
  listAdminPlayerScanHistory,
  listAdminRoster,
  listAdminRosterTeams,
  previewRosterImport,
  updateAdminPlayerContact,
  updateAdminTeamScore,
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

adminRouter.get(
  '/admin/events/:eventId/teams/:teamId/detail',
  validate(adminEventTeamParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const teamId = String(request.params.teamId);

    response.json(
      successResponse(await getAdminTeamDetail(eventId, teamId), {
        requestId: response.locals.requestId,
      })
    );
  })
);

adminRouter.patch(
  '/admin/events/:eventId/teams/:teamId/score',
  validate(adminEventTeamParamsSchema, 'params'),
  validate(updateAdminTeamScoreSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const teamId = String(request.params.teamId);
    const authContext = getRequestAuthContext(response);

    response.json(
      successResponse(
        await updateAdminTeamScore(eventId, teamId, request.body, {
          actorUserId: authContext?.userId,
        }),
        { requestId: response.locals.requestId }
      )
    );
  })
);

adminRouter.delete(
  '/admin/events/:eventId/teams/:teamId',
  validate(adminEventTeamParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const teamId = String(request.params.teamId);
    const authContext = getRequestAuthContext(response);

    response.json(
      successResponse(
        await deleteAdminTeam(eventId, teamId, {
          actorUserId: authContext?.userId,
        }),
        { requestId: response.locals.requestId }
      )
    );
  })
);

adminRouter.get(
  '/admin/events/:eventId/players/:playerId/detail',
  validate(adminEventRosterPlayerParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const playerId = String(request.params.playerId);

    response.json(
      successResponse(await getAdminPlayerDetail(eventId, playerId), {
        requestId: response.locals.requestId,
      })
    );
  })
);

adminRouter.patch(
  '/admin/events/:eventId/players/:playerId/contact',
  validate(adminEventRosterPlayerParamsSchema, 'params'),
  validate(updateAdminPlayerContactSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const playerId = String(request.params.playerId);
    const authContext = getRequestAuthContext(response);

    response.json(
      successResponse(
        await updateAdminPlayerContact(eventId, playerId, request.body, {
          actorUserId: authContext?.userId,
        }),
        { requestId: response.locals.requestId }
      )
    );
  })
);

adminRouter.get(
  '/admin/events/:eventId/players/:playerId/scan-history',
  validate(adminEventRosterPlayerParamsSchema, 'params'),
  validate(adminPlayerScanHistoryQuerySchema, 'query'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const playerId = String(request.params.playerId);

    response.json(
      successResponse(
        await listAdminPlayerScanHistory(
          eventId,
          playerId,
          request.query as { limit?: number; cursor?: string }
        ),
        { requestId: response.locals.requestId }
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
  '/admin/events/:eventId/qr-codes',
  validate(adminEventParamsSchema, 'params'),
  validate(createAdminQRCodeSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const authContext = getRequestAuthContext(response);

    response.json(
      successResponse(
        await createAdminQRCode(eventId, request.body, {
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
  '/admin/events/:eventId/qr-codes',
  validate(adminEventParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);

    response.json(
      successResponse(await listAdminQRCodes(eventId), { requestId: response.locals.requestId })
    );
  })
);

adminRouter.patch(
  '/admin/events/:eventId/qr-codes/:qrCodeId/status',
  validate(adminEventQrCodeParamsSchema, 'params'),
  validate(setAdminQRCodeStatusSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const qrCodeId = String(request.params.qrCodeId);
    const authContext = getRequestAuthContext(response);

    response.json(
      successResponse(
        await setAdminQRCodeStatus(eventId, qrCodeId, request.body, {
          actorUserId: authContext?.userId,
        }),
        {
          requestId: response.locals.requestId,
        }
      )
    );
  })
);

adminRouter.delete(
  '/admin/events/:eventId/qr-codes/:qrCodeId',
  validate(adminEventQrCodeParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const qrCodeId = String(request.params.qrCodeId);
    const authContext = getRequestAuthContext(response);

    response.json(
      successResponse(
        await softDeleteAdminQRCode(eventId, qrCodeId, {
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

adminRouter.get(
  '/admin/events/:eventId/race-control',
  validate(adminEventParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    response.json(
      successResponse(await getRaceControl(eventId), {
        requestId: response.locals.requestId,
      })
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

adminRouter.get(
  '/admin/events/:eventId/hazard-settings',
  validate(adminEventParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    response.json(
      successResponse(await getEventHazardSettings(eventId), {
        requestId: response.locals.requestId,
      })
    );
  })
);

adminRouter.patch(
  '/admin/events/:eventId/hazard-settings',
  validate(adminEventParamsSchema, 'params'),
  validate(updateEventHazardSettingsSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const authContext = getRequestAuthContext(response);

    response.json(
      successResponse(
        await updateEventHazardSettings(eventId, request.body, {
          actorUserId: authContext?.userId,
        }),
        { requestId: response.locals.requestId }
      )
    );
  })
);

adminRouter.post(
  '/admin/events/:eventId/qr-codes/import/preview',
  validate(adminEventParamsSchema, 'params'),
  validate(qrImportPreviewSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    response.json(
      successResponse(await previewQrImport(eventId, request.body), {
        requestId: response.locals.requestId,
      })
    );
  })
);

adminRouter.post(
  '/admin/events/:eventId/qr-codes/import/apply',
  validate(adminEventParamsSchema, 'params'),
  validate(qrImportApplySchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const authContext = getRequestAuthContext(response);
    response.json(
      successResponse(
        await applyQrImport(eventId, request.body, {
          actorUserId: authContext?.userId,
        }),
        { requestId: response.locals.requestId }
      )
    );
  })
);

adminRouter.post(
  '/admin/events/:eventId/qr-codes/export',
  validate(adminEventParamsSchema, 'params'),
  validate(exportQrAssetsSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    response.json(
      successResponse(await exportQrAssets(eventId, request.body), {
        requestId: response.locals.requestId,
      })
    );
  })
);

adminRouter.get(
  '/admin/events/:eventId/hazard-multipliers',
  validate(adminEventParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    response.json(
      successResponse(await listHazardMultiplierRules(eventId), {
        requestId: response.locals.requestId,
      })
    );
  })
);

adminRouter.post(
  '/admin/events/:eventId/hazard-multipliers',
  validate(adminEventParamsSchema, 'params'),
  validate(createHazardMultiplierRuleSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const authContext = getRequestAuthContext(response);
    response.json(
      successResponse(
        await createHazardMultiplierRule(eventId, request.body, {
          actorUserId: authContext?.userId,
        }),
        { requestId: response.locals.requestId }
      )
    );
  })
);

adminRouter.patch(
  '/admin/events/:eventId/hazard-multipliers/:ruleId',
  validate(adminEventMultiplierRuleParamsSchema, 'params'),
  validate(updateHazardMultiplierRuleSchema),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const ruleId = String(request.params.ruleId);
    const authContext = getRequestAuthContext(response);
    response.json(
      successResponse(
        await updateHazardMultiplierRule(eventId, ruleId, request.body, {
          actorUserId: authContext?.userId,
        }),
        { requestId: response.locals.requestId }
      )
    );
  })
);

adminRouter.delete(
  '/admin/events/:eventId/hazard-multipliers/:ruleId',
  validate(adminEventMultiplierRuleParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const ruleId = String(request.params.ruleId);
    const authContext = getRequestAuthContext(response);
    response.json(
      successResponse(
        await deleteHazardMultiplierRule(eventId, ruleId, {
          actorUserId: authContext?.userId,
        }),
        { requestId: response.locals.requestId }
      )
    );
  })
);

adminRouter.post(
  '/admin/users/:userId/capabilities',
  validate(adminUserParamsSchema, 'params'),
  validate(updateUserCapabilitiesSchema),
  asyncHandler(async (request, response) => {
    const userId = String(request.params.userId);
    const authContext = getRequestAuthContext(response);

    response.json(
      successResponse(
        await updateUserCapabilities(userId, request.body, {
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
  validate(adminAuditListQuerySchema, 'query'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const { cursor, limit } = request.query as { cursor?: string; limit?: number };

    response.json(
      successResponse(await listAdminAudits(eventId, { cursor, limit }), {
        requestId: response.locals.requestId,
      })
    );
  })
);
