import { Buffer } from 'node:buffer';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Request } from 'express';

import { env } from '../config/env.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { notFoundHandler } from '../middleware/notFoundHandler.js';
import { requestContext } from '../middleware/requestContext.js';
import { requestLogger } from '../middleware/requestLogger.js';
import { apiRouter } from '../routes/index.js';
import { healthRouter } from '../routes/health.js';
import { logger } from '../lib/logger.js';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_ALLOWED_ORIGINS,
      credentials: true,
    })
  );
  app.use(requestContext);
  app.use(requestLogger);
  app.use(
    express.json({
      limit: '1mb',
      verify: (request, _response, buffer) => {
        // Raw body is preserved for webhook signature verification middleware.
        (request as RequestWithRawBody).rawBody = Buffer.from(buffer);
      },
    })
  );

  // Health route stays outside API prefix to keep probes stable across prefix changes.
  app.use(healthRouter);

  // Product API routes are namespaced via env-configured prefix.
  app.use(env.API_PREFIX, apiRouter);
  logger.info('Setup API routes with prefix', { prefix: env.API_PREFIX });
  // Terminal middleware order: 404 translation first, centralized error mapping last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
