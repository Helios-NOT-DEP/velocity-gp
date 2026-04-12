import { Router } from 'express';

import { successResponse } from '@velocity-gp/api-contract/http';
import type { ListTeamActivityFeedQuery, PlayerActiveIdentity } from '@velocity-gp/api-contract';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import {
  eventParamsSchema,
  teamActivityFeedParamsSchema,
  teamActivityFeedQuerySchema,
} from '@velocity-gp/api-contract/schemas';
import { getCurrentEvent, getEvent, listEvents } from '../services/eventService.js';
import { getSessionFromAuthInputs } from '../services/authService.js';
import { prisma } from '../db/client.js';
import { AppError } from '../utils/appError.js';
import { listTeamActivityFeed } from '../services/teamActivityFeedService.js';

export const eventRouter = Router();

// Event discovery endpoints for current context + detail lookup.

/**
 * GET /events
 *
 * Lists all active and upcoming events available in the system.
 * Useful for building rosters and admin dashboards.
 */
eventRouter.get(
  '/events',
  asyncHandler(async (_request, response) => {
    response.json(successResponse(await listEvents(), { requestId: response.locals.requestId }));
  })
);

/**
 * GET /events/current
 *
 * Fetches the singularly active event running currently.
 * Returns the event summary including ID and timing information.
 */
eventRouter.get(
  '/events/current',
  asyncHandler(async (_request, response) => {
    response.json(
      successResponse(await getCurrentEvent(), { requestId: response.locals.requestId })
    );
  })
);

/**
 * GET /events/current/players/me
 *
 * Returns the PlayerActiveIdentity for the currently authenticated session.
 * This looks up the active session (via authorization/cookie), guarantees the
 * user has an active event team assignment via the auth service, and queries
 * the database to fetch the missing team name for the response contract.
 */
eventRouter.get(
  '/events/current/players/me',
  asyncHandler(async (request, response) => {
    // Retrieve the authenticated session using tokens from headers/cookies.
    // getSessionFromAuthInputs guarantees that the user exists and the event is ACTIVE.
    const { session } = await getSessionFromAuthInputs(
      request.header('authorization'),
      request.header('cookie')
    );

    // Ensure the player has a team assignment. Only assigned players can scan QR codes.
    if (!session.teamId) {
      throw new AppError(404, 'PLAYER_NOT_ASSIGNED', 'Player is not fully assigned to a team');
    }

    // Since the auth session token encodes teamId but not teamName,
    // query the database directly to fetch the team name.
    const team = await prisma.team.findUnique({
      where: { id: session.teamId },
      select: { name: true },
    });

    if (!team) {
      throw new AppError(404, 'TEAM_NOT_FOUND', 'Player team could not be loaded');
    }

    // Assemble the active identity required by the frontend scanner.
    const identity: PlayerActiveIdentity = {
      eventId: session.eventId,
      playerId: session.playerId,
      teamId: session.teamId,
      teamName: team.name,
      email: session.email,
    };

    response.json(successResponse(identity, { requestId: response.locals.requestId }));
  })
);

eventRouter.get(
  '/events/:eventId/teams/:teamId/activity-feed',
  validate(teamActivityFeedParamsSchema, 'params'),
  validate(teamActivityFeedQuerySchema, 'query'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);
    const teamId = String(request.params.teamId);
    const query = request.query as ListTeamActivityFeedQuery;

    const { session } = await getSessionFromAuthInputs(
      request.header('authorization'),
      request.header('cookie')
    );

    if (session.eventId !== eventId) {
      throw new AppError(
        403,
        'AUTH_EVENT_CONTEXT_MISMATCH',
        'Session is not scoped to this event.'
      );
    }

    if (!session.teamId || session.teamId !== teamId) {
      throw new AppError(403, 'AUTH_TEAM_CONTEXT_MISMATCH', 'Session is not scoped to this team.');
    }

    response.json(
      successResponse(await listTeamActivityFeed(eventId, teamId, query.limit), {
        requestId: response.locals.requestId,
      })
    );
  })
);

/**
 * GET /events/:eventId
 *
 * Fetches the details of a specific event by its ID.
 * Request parameters are validated against eventParamsSchema.
 */
eventRouter.get(
  '/events/:eventId',
  validate(eventParamsSchema, 'params'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.eventId);

    response.json(
      successResponse(await getEvent(eventId), { requestId: response.locals.requestId })
    );
  })
);
