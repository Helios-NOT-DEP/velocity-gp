import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { releaseExpiredTeamsFromPit } from './pitReleaseService.js';

let schedulerHandle: ReturnType<typeof globalThis.setInterval> | null = null;
let schedulerTickInFlight = false;

async function runSchedulerTick(): Promise<void> {
  if (schedulerTickInFlight) {
    return;
  }

  schedulerTickInFlight = true;

  try {
    await releaseExpiredTeamsFromPit();
  } catch (error) {
    logger.error({ err: error }, 'pit release scheduler tick failed');
  } finally {
    schedulerTickInFlight = false;
  }
}

export function startPitReleaseScheduler(): () => void {
  if (!env.PIT_RELEASE_SCHEDULER_ENABLED) {
    logger.info('pit release scheduler disabled by configuration');
    return stopPitReleaseScheduler;
  }

  if (schedulerHandle) {
    return stopPitReleaseScheduler;
  }

  schedulerHandle = globalThis.setInterval(() => {
    void runSchedulerTick();
  }, env.PIT_RELEASE_POLL_INTERVAL_MS);

  schedulerHandle.unref();
  void runSchedulerTick();

  logger.info(
    {
      intervalMs: env.PIT_RELEASE_POLL_INTERVAL_MS,
    },
    'pit release scheduler started'
  );

  return stopPitReleaseScheduler;
}

export function stopPitReleaseScheduler(): void {
  if (!schedulerHandle) {
    return;
  }

  globalThis.clearInterval(schedulerHandle);
  schedulerHandle = null;
  logger.info('pit release scheduler stopped');
}
