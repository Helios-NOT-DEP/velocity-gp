import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { ExpressAuth, authConfig as defaultAuthConfig } from '../auth/config.js';
import { env } from '../config/env.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { notFoundHandler } from '../middleware/notFoundHandler.js';
import { requestContext } from '../middleware/requestContext.js';
import { requestLogger } from '../middleware/requestLogger.js';
import { createApiRouter } from '../routes/index.js';
import { healthRouter } from '../routes/health.js';

type CreateAppOptions = {
  authConfig?: Parameters<typeof ExpressAuth>[0];
};

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const authConfig = options.authConfig ?? defaultAuthConfig;

  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    })
  );
  app.use(requestContext);
  app.use(requestLogger);
  app.use(express.json({ limit: '1mb' }));

  app.use('/auth/*', ExpressAuth(authConfig));
  app.use(healthRouter);
  app.use(env.API_PREFIX, createApiRouter(authConfig));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
