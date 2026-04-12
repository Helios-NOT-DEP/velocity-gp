import { createApp } from './app/createApp.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { startPitReleaseScheduler } from './services/pitReleaseScheduler.js';

const app = createApp();
// Background scheduler is process-scoped and starts with HTTP server boot.
const stopPitReleaseScheduler = startPitReleaseScheduler();

app.listen(env.PORT, env.HOST, () => {
  logger.info('Velocity GP backend listening', {
    host: env.HOST,
    port: env.PORT,
    apiPrefix: env.API_PREFIX,
  });
});

type ShutdownSignal = 'SIGINT' | 'SIGTERM';

function handleShutdownSignal(signal: ShutdownSignal): void {
  logger.info('received shutdown signal', { signal });
  // Ensure timers/subscriptions are torn down before process exits.
  stopPitReleaseScheduler();
  process.exit(0);
}

process.on('SIGINT', () => handleShutdownSignal('SIGINT'));
process.on('SIGTERM', () => handleShutdownSignal('SIGTERM'));
