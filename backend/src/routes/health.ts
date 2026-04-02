import { Router } from 'express';

import { successResponse } from '../contracts/http.js';
import { getDatabaseConfig } from '../db/client.js';

export const healthRouter = Router();

healthRouter.get('/health', (_request, response) => {
  response.json(
    successResponse({
      status: 'ok',
      service: 'velocity-gp-bff',
      databaseConfigured: getDatabaseConfig().configured,
    })
  );
});

healthRouter.get('/ready', (_request, response) => {
  response.json(
    successResponse({
      status: 'ready',
      checks: {
        api: true,
        databaseConfigured: getDatabaseConfig().configured,
      },
    })
  );
});
