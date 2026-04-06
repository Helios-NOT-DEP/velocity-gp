import { createApp } from './app/createApp.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { startPitReleaseScheduler } from './services/pitReleaseScheduler.js';

const app = createApp();
const stopPitReleaseScheduler = startPitReleaseScheduler();

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

type ShutdownSignal = 'SIGINT' | 'SIGTERM';

function handleShutdownSignal(signal: ShutdownSignal): void {
  logger.info({ signal }, 'received shutdown signal');
  stopPitReleaseScheduler();
  process.exit(0);
}

process.on('SIGINT', () => handleShutdownSignal('SIGINT'));
process.on('SIGTERM', () => handleShutdownSignal('SIGTERM'));
