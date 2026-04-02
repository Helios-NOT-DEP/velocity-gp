import { Router } from 'express';

import { eventRouter } from './event.js';
import { gameRouter } from './game.js';
import { hazardRouter } from './hazard.js';
import { playerRouter } from './player.js';
import { rescueRouter } from './rescue.js';
import { teamRouter } from './team.js';

export const apiRouter = Router();

apiRouter.use(eventRouter);
apiRouter.use(gameRouter);
apiRouter.use(hazardRouter);
apiRouter.use(playerRouter);
apiRouter.use(rescueRouter);
apiRouter.use(teamRouter);
