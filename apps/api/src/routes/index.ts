import { Router } from 'express';

import { adminRouter } from './admin.js';
import { devMockRouter } from './devMock.js';
import { eventRouter } from './event.js';
import { gameRouter } from './game.js';
import { garageRouter } from './garage.js';
import { hazardRouter } from './hazard.js';
import { playerRouter } from './player.js';
import { rescueRouter } from './rescue.js';
import { scanRouter } from './scan.js';
import { teamRouter } from './team.js';

export const apiRouter = Router();

apiRouter.use(adminRouter);
apiRouter.use(devMockRouter);
apiRouter.use(eventRouter);
apiRouter.use(gameRouter);
// Garage workflow: player description submission + team logo polling
apiRouter.use(garageRouter);
apiRouter.use(hazardRouter);
apiRouter.use(playerRouter);
apiRouter.use(rescueRouter);
apiRouter.use(scanRouter);
apiRouter.use(teamRouter);
