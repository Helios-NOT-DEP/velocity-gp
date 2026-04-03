import { Router } from 'express';
import type { ExpressAuthConfig } from '@auth/express';

import { createAuthApiRouter } from './auth.js';
import { eventRouter } from './event.js';
import { gameRouter } from './game.js';
import { hazardRouter } from './hazard.js';
import { playerRouter } from './player.js';
import { rescueRouter } from './rescue.js';
import { teamRouter } from './team.js';

export function createApiRouter(authConfig: ExpressAuthConfig) {
  const apiRouter = Router();

  apiRouter.use(createAuthApiRouter(authConfig));
  apiRouter.use(eventRouter);
  apiRouter.use(gameRouter);
  apiRouter.use(hazardRouter);
  apiRouter.use(playerRouter);
  apiRouter.use(rescueRouter);
  apiRouter.use(teamRouter);

  return apiRouter;
}
