import { createApp } from './app/createApp.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { startPitReleaseScheduler } from './services/pitReleaseScheduler.js';

const app = createApp();
const stopPitReleaseScheduler = startPitReleaseScheduler();

app.listen(env.PORT, env.HOST, () => {
  logger.debug('Velocity GP backend listening', {
    host: env.HOST,
    port: env.PORT,
    apiPrefix: env.API_PREFIX,
  });
});

type ShutdownSignal = 'SIGINT' | 'SIGTERM';

function handleShutdownSignal(signal: ShutdownSignal): void {
  logger.debug('received shutdown signal', { signal });
  stopPitReleaseScheduler();
  process.exit(0);
}

process.on('SIGINT', () => handleShutdownSignal('SIGINT'));
process.on('SIGTERM', () => handleShutdownSignal('SIGTERM'));
