import { createApp } from './app/createApp.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

const app = createApp();

app.listen(env.PORT, env.HOST, () => {
  logger.info(
    {
      host: env.HOST,
      port: env.PORT,
      apiPrefix: env.API_PREFIX,
    },
    'Velocity GP backend listening'
  );
});
