import { Router } from 'express';

import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { createTeamSchema, joinTeamSchema, teamParamsSchema } from '@velocity-gp/api-contract/schemas';
import { createTeam, getTeam, getTeamMembers, joinTeam } from '../services/teamService.js';

export const teamRouter = Router();

teamRouter.post(
  '/teams',
  validate(createTeamSchema),
  asyncHandler(async (request, response) => {
    response
      .status(201)
      .json(successResponse(createTeam(request.body), { requestId: response.locals.requestId }));
  })
);

teamRouter.get(
  '/teams/:teamId',
  validate(teamParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const teamId = String(request.params.teamId);

    response.json(successResponse(getTeam(teamId), { requestId: response.locals.requestId }));
  })
);

teamRouter.post(
  '/teams/:teamId/join',
  validate(teamParamsSchema, 'params'),
  validate(joinTeamSchema),
  asyncHandler(async (request, response) => {
    const teamId = String(request.params.teamId);

    response.json(
      successResponse(joinTeam(teamId, request.body), { requestId: response.locals.requestId })
    );
  })
);

teamRouter.get(
  '/teams/:teamId/members',
  validate(teamParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const teamId = String(request.params.teamId);

    response.json(
      successResponse(getTeamMembers(teamId), { requestId: response.locals.requestId })
    );
  })
);
