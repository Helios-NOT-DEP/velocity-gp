import { Router } from 'express';

import { successResponse } from '@velocity-gp/api-contract/http';
import { buildInfo } from '../config/buildInfo.js';
import { getDatabaseConfig } from '../db/client.js';

export const healthRouter = Router();

// Liveness probe: process is up and serving HTTP.
healthRouter.get('/health', (_request, response) => {
  response.json(
    successResponse({
      status: 'ok',
      service: 'velocity-gp-bff',
      version: buildInfo.version,
      databaseConfigured: getDatabaseConfig().configured,
    })
  );
});

// Readiness probe: API dependencies are configured for traffic.
healthRouter.get('/ready', (_request, response) => {
  response.json(
    successResponse({
      status: 'ready',
      version: buildInfo.version,
      checks: {
        api: true,
        databaseConfigured: getDatabaseConfig().configured,
      },
    })
  );
});
