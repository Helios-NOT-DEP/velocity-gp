import { Router } from 'express';

import { adminRouter } from './admin.js';
import { authRouter } from './auth.js';
import { emailWebhookRouter } from './emailWebhook.js';
import { eventRouter } from './event.js';
import { gameRouter } from './game.js';
import { hazardRouter } from './hazard.js';
import { playerRouter } from './player.js';
import { rescueRouter } from './rescue.js';
import { scanRouter } from './scan.js';
import { teamRouter } from './team.js';

export const apiRouter = Router();

// Route order is intentionally stable so broad prefixes do not shadow specific handlers.
apiRouter.use(adminRouter);
apiRouter.use(authRouter);
apiRouter.use(emailWebhookRouter);
apiRouter.use(eventRouter);
apiRouter.use(gameRouter);
apiRouter.use(hazardRouter);
apiRouter.use(playerRouter);
apiRouter.use(rescueRouter);
apiRouter.use(scanRouter);
apiRouter.use(teamRouter);
