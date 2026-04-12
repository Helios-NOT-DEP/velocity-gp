import { Router } from 'express';

import { successResponse } from '@velocity-gp/api-contract/http';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  createTeamSchema,
  joinTeamSchema,
  teamParamsSchema,
} from '@velocity-gp/api-contract/schemas';
import { generateTeamLogo } from '../services/n8nService.js';
import { createTeam, getTeam, getTeamMembers, joinTeam } from '../services/teamService.js';

export const teamRouter = Router();

// Team management endpoints for creation, joining, and roster retrieval.
teamRouter.post(
  '/teams/logo',
  asyncHandler(async (request, response, _next) => {
    const { description, teamName } = request.body;

    if (!description || !teamName) {
      response.status(400).json({ error: 'description and teamName are required' });
      return;
    }

    try {
      const imageUrl = await generateTeamLogo({ description, teamName });
      response.json({ imageUrl });
    } catch (err) {
      const details = err instanceof Error ? err.message : 'Unknown error';
      response.status(500).json({ error: 'Failed to generate logo', details });
    }
  })
);

// POST /teams/logo - generate a team logo via N8N
teamRouter.post(
  '/teams/logo',
  asyncHandler(async (request, response, _next) => {
    const { description, teamName } = request.body;

    if (!description || !teamName) {
      response.status(400).json({ error: 'description and teamName are required' });
      return;
    }

    try {
      const imageUrl = await generateTeamLogo({ description, teamName });
      response.json({ imageUrl });
    } catch (err) {
      const details = err instanceof Error ? err.message : 'Unknown error';
      response.status(500).json({ error: 'Failed to generate logo', details });
    }
  })
);

// Team management endpoints for creation, joining, and roster retrieval.
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
